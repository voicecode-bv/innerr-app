<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Server-side helpers for media from NativePhp Camera paths:
 *   - serveMedia        reads file:// path → data URL for preview
 *   - storeCroppedMedia base64 cropped image → temporary file on disk
 *
 * The actual post-create goes through Spa\PostsController::store.
 */
class PostActionController extends Controller
{
    /**
     * Cap for `serveMedia` data URL responses. We accept up to ~50 MB
     * inline because NativePHP iOS' PHPSchemeHandler pushes PHP output
     * through a UTF-8 string round-trip; binary bytes don't survive that,
     * so a base64 data URL in JSON is the only workable route for both
     * photo and video previews. Above this cap we return 413 so the SPA
     * can gracefully fall back to a placeholder.
     */
    private const SERVE_DATA_URL_MAX_BYTES = 50 * 1024 * 1024;

    public function serveMedia(Request $request): Response
    {
        $path = $request->query('path');

        abort_unless(is_string($path) && file_exists($path), 404);

        $size = filesize($path) ?: 0;

        abort_if($size > self::SERVE_DATA_URL_MAX_BYTES, 413, __('File too large for inline preview.'));

        // display_errors off so stray PHP warnings don't corrupt the
        // JSON.
        @ini_set('display_errors', '0');

        $mime = File::mimeType($path) ?: 'application/octet-stream';

        // JSON envelope: `{"data_url":"data:<mime>;base64,<base64>"}`
        // Pre-compute so we can send Content-Length and the client can
        // tell if the body gets truncated. base64 output is exactly
        // `4 * ceil(file_size / 3)` bytes; the envelope is a fixed prefix+suffix.
        $prefix = '{"data_url":"data:'.$mime.';base64,';
        $suffix = '"}';
        $base64Length = 4 * (int) ceil($size / 3);
        $contentLength = strlen($prefix) + $base64Length + strlen($suffix);

        Log::info('serveMedia start', [
            'path' => $path,
            'size_mb' => round($size / 1024 / 1024, 2),
            'expected_response_mb' => round($contentLength / 1024 / 1024, 2),
            'memory_limit' => ini_get('memory_limit'),
            'ob_level' => ob_get_level(),
        ]);

        // Streamed response: encode base64 in 192 KB chunks (multiple of 3
        // so we don't get padding in the middle of the stream). Avoids ever
        // holding the whole file + base64 copy in memory at once — the
        // previous approach kept 4 copies (file + base64 + concat + json
        // encode buffer) and got killed on iOS for videos of ~30 MB+.
        return new StreamedResponse(function () use ($path, $prefix, $suffix) {
            try {
                echo $prefix;

                $handle = fopen($path, 'rb');

                if ($handle === false) {
                    Log::error('serveMedia stream: fopen failed', ['path' => $path]);

                    return;
                }

                $chunkSize = 3 * 65536; // 192 KB → 256 KB base64
                $bytesRead = 0;

                while (! feof($handle)) {
                    $chunk = fread($handle, $chunkSize);

                    if ($chunk === false || $chunk === '') {
                        break;
                    }

                    echo base64_encode($chunk);
                    $bytesRead += strlen($chunk);
                }

                fclose($handle);
                echo $suffix;

                Log::info('serveMedia stream done', [
                    'bytes_read' => $bytesRead,
                    'memory_peak_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 1),
                ]);
            } catch (Throwable $e) {
                // Headers have already been sent, so the body becomes corrupt JSON.
                // Logging is the only thing left we can do.
                Log::error('serveMedia stream threw', [
                    'exception' => $e::class,
                    'message' => $e->getMessage(),
                    'memory_peak_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 1),
                ]);
            }
        }, 200, [
            'Content-Type' => 'application/json',
            'Content-Length' => (string) $contentLength,
            'Cache-Control' => 'no-cache, private',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    public function storeCroppedMedia(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'data' => ['required', 'string'],
            'taken_at' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $contents = base64_decode($validated['data'], true);

        if ($contents === false) {
            return response()->json(['message' => __('Invalid cropped image')], 422);
        }

        $size = strlen($contents);

        if ($size === 0 || $size > 20 * 1024 * 1024) {
            return response()->json(['message' => __('Invalid cropped image')], 422);
        }

        $directory = self::croppedMediaDirectory();
        File::ensureDirectoryExists($directory);

        $path = $directory.'/'.uniqid('crop_', true).'.jpg';
        file_put_contents($path, $contents);

        $exif = array_filter([
            'taken_at' => $validated['taken_at'] ?? null,
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
        ], fn ($value) => $value !== null);

        if ($exif !== []) {
            file_put_contents($path.'.exif.json', json_encode($exif));
        }

        return response()->json(['path' => $path]);
    }

    public static function croppedMediaDirectory(): string
    {
        return storage_path('app/private/cropped');
    }
}
