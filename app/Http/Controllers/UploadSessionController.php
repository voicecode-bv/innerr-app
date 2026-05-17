<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * Chunked upload van gecropte beelden. WKWebView strips multipart bodies dus
 * de SPA stuurt base64-chunks in JSON; deze controller plakt ze server-side
 * weer aan elkaar. Vervangt het base64-in-één-keer patroon van
 * `PostActionController::storeCroppedMedia` voor grote beelden.
 *
 * Lifecycle:
 *   POST   /posts/upload-session                       → {upload_id, chunk_size}
 *   POST   /posts/upload-session/{upload_id}/chunk     → write chunk; final=true assembleert
 *   DELETE /posts/upload-session/{upload_id}           → abort + cleanup
 */
class UploadSessionController extends Controller
{
    public const CHUNK_SIZE_BYTES = 1024 * 1024;

    public const MAX_CHUNKS = 50;

    private const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

    private const MAX_BASE64_CHUNK_BYTES = 2 * 1024 * 1024;

    public function init(Request $request): JsonResponse
    {
        $uploadId = (string) Str::uuid();
        $directory = self::sessionDirectory($uploadId);

        File::ensureDirectoryExists($directory);

        file_put_contents($directory.'/meta.json', json_encode([
            'user_id' => Auth::id(),
            'created_at' => now()->toIso8601String(),
        ]));

        return response()->json([
            'upload_id' => $uploadId,
            'chunk_size' => self::CHUNK_SIZE_BYTES,
            'max_chunks' => self::MAX_CHUNKS,
        ]);
    }

    public function chunk(Request $request, string $uploadId): JsonResponse
    {
        if (! Str::isUuid($uploadId)) {
            return response()->json(['message' => __('Invalid upload session.')], 404);
        }

        $directory = self::sessionDirectory($uploadId);

        if (! is_dir($directory) || ! $this->sessionBelongsToUser($directory)) {
            return response()->json(['message' => __('Invalid upload session.')], 404);
        }

        $validated = $request->validate([
            'sequence' => ['required', 'integer', 'min:0', 'max:'.(self::MAX_CHUNKS - 1)],
            'data' => ['required', 'string', 'max:'.self::MAX_BASE64_CHUNK_BYTES],
            'final' => ['sometimes', 'boolean'],
            'taken_at' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $binary = base64_decode($validated['data'], true);

        if ($binary === false) {
            return response()->json(['message' => __('Invalid chunk data.')], 422);
        }

        $chunkPath = $directory.'/'.self::chunkFilename($validated['sequence']);
        file_put_contents($chunkPath, $binary);

        if ((int) $this->totalSize($directory) > self::MAX_TOTAL_BYTES) {
            $this->cleanup($directory);

            return response()->json(['message' => __('Upload exceeds maximum size.')], 422);
        }

        if (! ($validated['final'] ?? false)) {
            return response()->json(['received' => true, 'sequence' => $validated['sequence']]);
        }

        return $this->finalize($directory, $uploadId, $validated);
    }

    public function abort(string $uploadId): JsonResponse
    {
        if (! Str::isUuid($uploadId)) {
            return response()->json(['message' => __('Invalid upload session.')], 404);
        }

        $directory = self::sessionDirectory($uploadId);

        if (is_dir($directory) && $this->sessionBelongsToUser($directory)) {
            $this->cleanup($directory);
        }

        return response()->json(['ok' => true]);
    }

    public static function sessionsDirectory(): string
    {
        return storage_path('app/private/uploads');
    }

    public static function sessionDirectory(string $uploadId): string
    {
        return self::sessionsDirectory().'/'.$uploadId;
    }

    private static function chunkFilename(int $sequence): string
    {
        return 'chunk_'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    private function sessionBelongsToUser(string $directory): bool
    {
        $metaPath = $directory.'/meta.json';

        if (! file_exists($metaPath)) {
            return false;
        }

        $meta = json_decode((string) file_get_contents($metaPath), true) ?? [];

        return ($meta['user_id'] ?? null) === Auth::id();
    }

    private function totalSize(string $directory): int
    {
        $total = 0;

        foreach (glob($directory.'/chunk_*') ?: [] as $file) {
            $total += filesize($file) ?: 0;
        }

        return $total;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function finalize(string $directory, string $uploadId, array $validated): JsonResponse
    {
        $chunks = glob($directory.'/chunk_*') ?: [];

        if ($chunks === []) {
            $this->cleanup($directory);

            return response()->json(['message' => __('Upload has no chunks.')], 422);
        }

        sort($chunks, SORT_STRING);

        $targetDir = PostActionController::croppedMediaDirectory();
        File::ensureDirectoryExists($targetDir);

        $targetPath = $targetDir.'/'.$uploadId.'.jpg';
        $output = fopen($targetPath, 'wb');

        if ($output === false) {
            $this->cleanup($directory);

            return response()->json(['message' => __('Could not assemble upload.')], 500);
        }

        foreach ($chunks as $chunk) {
            $handle = fopen($chunk, 'rb');

            if ($handle === false) {
                fclose($output);
                @unlink($targetPath);
                $this->cleanup($directory);

                return response()->json(['message' => __('Could not assemble upload.')], 500);
            }

            stream_copy_to_stream($handle, $output);
            fclose($handle);
        }

        fclose($output);

        $size = filesize($targetPath) ?: 0;

        if ($size === 0 || $size > self::MAX_TOTAL_BYTES) {
            @unlink($targetPath);
            $this->cleanup($directory);

            return response()->json(['message' => __('Invalid assembled upload.')], 422);
        }

        $exif = array_filter([
            'taken_at' => $validated['taken_at'] ?? null,
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
        ], fn ($v) => $v !== null);

        if ($exif !== []) {
            file_put_contents($targetPath.'.exif.json', json_encode($exif));
        }

        $this->cleanup($directory);

        return response()->json(['path' => $targetPath]);
    }

    private function cleanup(string $directory): void
    {
        if (is_dir($directory)) {
            File::deleteDirectory($directory);
        }
    }
}
