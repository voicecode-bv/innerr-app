<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PostActionController;
use App\Services\ApiClient;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * BFF-only endpoint for post-creation — NativePhp Camera delivers a file://
 * path that is only readable server-side and must go to the external API as
 * multipart (WKWebView strips multipart bodies).
 *
 * Supports both single (legacy `media_path`) and multi (`media_paths[]` +
 * optional `media_metadata[]`). Per-item EXIF comes from `media_metadata` or
 * falls back to the `.exif.json` sidecar next to the file.
 *
 * Videos go through a chunked upload flow: the BFF stream-reads the local
 * file:// path in `UPLOAD_CHUNK_BYTES` pieces to `/api/uploads/{id}/chunk`,
 * and on finalize redeems the obtained `upload_token` via the `media_token(s)`
 * field on `/api/posts`. This keeps each individual HTTP request small enough
 * for the current api-client timeout and memory limits, even for 200+ MB clips.
 */
class PostsController extends Controller
{
    private const MAX_MEDIA_ITEMS = 10;

    private const EXIF_KEYS = ['taken_at', 'latitude', 'longitude'];

    /**
     * Per-chunk timeout for BFF → external API. On slow cellular networks
     * a 4 MB chunk can take a few dozen seconds; we give ample budget so
     * a single hiccup doesn't trigger an abort. The `api-client.timeout`
     * config stays at 15s for regular requests.
     */
    private const CHUNK_HTTP_TIMEOUT = 120;

    /**
     * Mime types we route via chunked upload instead of multipart attach. Photos
     * usually fit in a single request and the existing multipart code is already
     * tuned for that; chunked uploading for photos only adds overhead.
     */
    private const CHUNKED_MIME_PREFIXES = ['video/'];

    public function __construct(protected ApiClient $apiClient) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'media_path' => ['required_without:media_paths', 'string'],
            'media_paths' => ['required_without:media_path', 'array', 'min:1', 'max:'.self::MAX_MEDIA_ITEMS],
            'media_paths.*' => ['string'],
            'media_metadata' => ['nullable', 'array'],
            'media_metadata.*' => ['array'],
            'media_metadata.*.taken_at' => ['nullable', 'string'],
            'media_metadata.*.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'media_metadata.*.longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'caption' => ['nullable', 'string', 'max:2200'],
            'type' => ['nullable', 'string', 'in:media,quote'],
            'quote_text' => ['nullable', 'required_if:type,quote', 'string', 'max:280'],
            'quote_author' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'circle_ids' => ['required', 'array'],
            'circle_ids.*' => ['uuid'],
            'tag_ids' => ['nullable', 'array'],
            'tag_ids.*' => ['uuid'],
            'person_ids' => ['nullable', 'array'],
            'person_ids.*' => ['uuid'],
        ]);

        // Normalize to an array — internal logic has a single code path.
        $isLegacySingle = ! isset($validated['media_paths']);
        $paths = $isLegacySingle ? [$validated['media_path']] : array_values($validated['media_paths']);
        $inlineMetadata = $validated['media_metadata'] ?? [];

        foreach ($paths as $index => $path) {
            if (! file_exists($path)) {
                $key = $isLegacySingle ? 'media_path' : "media_paths.{$index}";
                throw ValidationException::withMessages([$key => __('Media file not found.')]);
            }
        }

        $perItemExif = [];
        foreach ($paths as $index => $path) {
            $perItemExif[$index] = $this->resolveExif($path, $inlineMetadata[$index] ?? null);
        }

        $data = [
            'caption' => $validated['caption'] ?? '',
            'location' => $validated['location'] ?? '',
            'circle_ids' => $validated['circle_ids'],
            'tag_ids' => $validated['tag_ids'] ?? [],
            'person_ids' => $validated['person_ids'] ?? [],
        ];

        // Quote posts carry their text + attribution alongside the rendered
        // image. Only forwarded when present so regular posts stay untouched
        // and the external API keeps defaulting `type` to 'media'.
        if (($validated['type'] ?? 'media') === 'quote') {
            $data['type'] = 'quote';
            $data['quote_text'] = $validated['quote_text'] ?? '';
            $data['quote_author'] = $validated['quote_author'] ?? null;
        }

        // Single-file path keeps the current external API shape (top-level
        // EXIF + single `media` field) so this keeps working without the
        // external API needing multi-support right away.
        if (count($paths) === 1) {
            foreach (self::EXIF_KEYS as $key) {
                if ($perItemExif[0][$key] ?? null) {
                    $data[$key] = $perItemExif[0][$key];
                }
            }
        } else {
            $data['media_metadata'] = json_encode(array_values($perItemExif));
        }

        // Post-level coordinates chosen via the map picker win over EXIF as the
        // post's position. Set last so they override the single-file EXIF block;
        // both must be present (the external API requires lat/lng together).
        if (isset($validated['latitude'], $validated['longitude'])) {
            $data['latitude'] = $validated['latitude'];
            $data['longitude'] = $validated['longitude'];
        }

        $mimeTypes = array_map(
            fn (string $path): string => File::mimeType($path) ?: 'application/octet-stream',
            $paths,
        );

        $shouldChunkAll = $paths !== [] && array_reduce(
            $mimeTypes,
            fn (bool $carry, string $mime): bool => $carry && $this->shouldUseChunkedUpload($mime),
            true,
        );

        try {
            $response = $shouldChunkAll
                ? $this->postWithChunkedUploads($paths, $mimeTypes, $data)
                : $this->postWithMultipartAttach($paths, $data);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages([
                $isLegacySingle ? 'media_path' : 'media_paths.0' => $e->getMessage(),
            ]);
        }

        foreach ($paths as $path) {
            if (str_starts_with($path, PostActionController::croppedMediaDirectory())) {
                @unlink($path);
                @unlink($path.'.exif.json');
            }
        }

        if (! $response->successful()) {
            if ($response->status() === 429) {
                return response()->json([
                    'message' => $response->json('message', __('Too many requests. Please try again shortly.')),
                ], 429, array_filter([
                    'Retry-After' => $response->header('Retry-After'),
                ]));
            }

            $this->throwMappedValidationException($response, $isLegacySingle);
        }

        return response()->json(['data' => $this->apiClient->proxyMediaUrls($response->json('data'))], 201);
    }

    /**
     * Multipart attach path — for images that fit in a single request.
     *
     * @param  list<string>  $paths
     * @param  array<string, mixed>  $data
     */
    private function postWithMultipartAttach(array $paths, array $data): Response
    {
        $request = $this->apiClient->authenticated();
        $multi = count($paths) > 1;
        $openHandles = [];

        try {
            foreach ($paths as $index => $path) {
                $mimeType = File::mimeType($path) ?: 'application/octet-stream';
                $filename = pathinfo($path, PATHINFO_FILENAME).'.'.$this->extensionFor($path, $mimeType);
                $handle = fopen($path, 'r');

                if ($handle === false) {
                    throw ValidationException::withMessages([
                        $multi ? "media_paths.{$index}" : 'media_path' => __('Could not read media file.'),
                    ]);
                }

                $openHandles[] = $handle;
                $fieldName = $multi ? 'media[]' : 'media';
                $request = $request->attach($fieldName, $handle, $filename, ['Content-Type' => $mimeType]);
            }

            return $request->post('/posts', $data);
        } finally {
            foreach ($openHandles as $handle) {
                if (is_resource($handle)) {
                    fclose($handle);
                }
            }
        }
    }

    /**
     * Chunked upload path: chunked POST to `/api/uploads/{id}/chunk`,
     * redeem the upload_token(s) via `/api/posts` without a multipart body.
     *
     * @param  list<string>  $paths
     * @param  list<string>  $mimeTypes
     * @param  array<string, mixed>  $data
     */
    private function postWithChunkedUploads(array $paths, array $mimeTypes, array $data): Response
    {
        $tokens = [];
        $sessionIdsToAbort = [];

        try {
            foreach ($paths as $index => $path) {
                [$tokens[], $sessionId] = $this->uploadFileInChunks($path, $mimeTypes[$index]);
                $sessionIdsToAbort[] = $sessionId;
            }

            if (count($tokens) === 1) {
                $data['media_token'] = $tokens[0];
            } else {
                $data['media_tokens'] = $tokens;
            }

            $response = $this->apiClient->authenticated()->post('/posts', $data);

            // The API cleans up consumed sessions itself on a 2xx; only
            // on a non-2xx do we still need to send an abort here.
            if (! $response->successful()) {
                $this->abortSessions($sessionIdsToAbort);
            }

            return $response;
        } catch (\Throwable $e) {
            $this->abortSessions($sessionIdsToAbort);

            throw $e;
        }
    }

    /**
     * Initialize an upload session with the external API and stream `$path` in
     * chunks of `chunk_size` bytes to `/api/uploads/{id}/chunk`. Returns
     * `[upload_token, session_id]`; on failure the session is already aborted
     * internally.
     *
     * @return array{0: string, 1: string}
     */
    private function uploadFileInChunks(string $path, string $mimeType): array
    {
        $init = $this->apiClient->authenticated()->post('/uploads');

        if (! $init->successful()) {
            throw new RuntimeException(__('Could not initialise upload session.'));
        }

        $uploadId = (string) $init->json('upload_id');
        $chunkSize = max(1, (int) $init->json('chunk_size'));
        $maxChunks = max(1, (int) $init->json('max_chunks'));
        $maxTotalBytes = (int) $init->json('max_total_bytes');

        $fileSize = filesize($path) ?: 0;

        if ($fileSize === 0) {
            $this->abortSessions([$uploadId]);

            throw new RuntimeException(__('Could not read media file.'));
        }

        if ($maxTotalBytes > 0 && $fileSize > $maxTotalBytes) {
            $this->abortSessions([$uploadId]);

            throw new RuntimeException(__('Media file is too large.'));
        }

        $chunkCount = max(1, (int) ceil($fileSize / $chunkSize));

        if ($chunkCount > $maxChunks) {
            $this->abortSessions([$uploadId]);

            throw new RuntimeException(__('Media file is too large.'));
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            $this->abortSessions([$uploadId]);

            throw new RuntimeException(__('Could not read media file.'));
        }

        try {
            for ($sequence = 0; $sequence < $chunkCount; $sequence++) {
                $buffer = fread($handle, $chunkSize);

                if ($buffer === false || $buffer === '') {
                    throw new RuntimeException(__('Could not read media file.'));
                }

                $isFinal = $sequence === $chunkCount - 1;
                $response = $this->postChunk($uploadId, $sequence, $buffer, $isFinal, $mimeType);

                try {
                    if (! $response->successful()) {
                        $response->throw();
                    }
                } catch (RequestException $e) {
                    throw new RuntimeException($e->response->json('message') ?? __('Upload failed.'));
                }

                if ($isFinal) {
                    $token = $response->json('upload_token');

                    if (! is_string($token)) {
                        throw new RuntimeException(__('Upload finalisation returned no token.'));
                    }

                    return [$token, $uploadId];
                }
            }

            throw new RuntimeException(__('Upload finalisation never reached.'));
        } finally {
            fclose($handle);
        }
    }

    private function postChunk(string $uploadId, int $sequence, string $bytes, bool $isFinal, string $mimeType): Response
    {
        // Wrap raw bytes in a memory resource so we don't have to write a
        // tempfile per chunk. The PendingRequest uses Guzzle multipart and
        // consumes the stream lazily.
        $stream = fopen('php://temp', 'r+');

        if ($stream === false) {
            throw new RuntimeException(__('Upload failed.'));
        }

        try {
            fwrite($stream, $bytes);
            rewind($stream);

            $request = $this->apiClient->authenticated()
                ->timeout(self::CHUNK_HTTP_TIMEOUT)
                ->attach('chunk', $stream, "chunk_{$sequence}", ['Content-Type' => 'application/octet-stream']);

            return $request->post("/uploads/{$uploadId}/chunk", [
                'sequence' => $sequence,
                'final' => $isFinal ? '1' : '0',
                'mime_type' => $mimeType,
            ]);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    /**
     * @param  list<string>  $sessionIds
     */
    private function abortSessions(array $sessionIds): void
    {
        foreach (array_unique($sessionIds) as $id) {
            try {
                $this->apiClient->authenticated()->delete("/uploads/{$id}");
            } catch (\Throwable) {
                // Best-effort; otherwise server-side GC cleans up later.
            }
        }
    }

    private function shouldUseChunkedUpload(string $mimeType): bool
    {
        foreach (self::CHUNKED_MIME_PREFIXES as $prefix) {
            if (str_starts_with($mimeType, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Merge inline metadata with .exif.json sidecar. Inline wins per key.
     *
     * @param  array<string, mixed>|null  $inline
     * @return array{taken_at: ?string, latitude: ?float, longitude: ?float}
     */
    private function resolveExif(string $path, ?array $inline): array
    {
        $exif = array_fill_keys(self::EXIF_KEYS, null);

        $sidecarPath = $path.'.exif.json';

        if (file_exists($sidecarPath)) {
            $sidecar = json_decode((string) file_get_contents($sidecarPath), true) ?? [];

            foreach (self::EXIF_KEYS as $key) {
                if (isset($sidecar[$key]) && $sidecar[$key] !== null) {
                    $exif[$key] = $sidecar[$key];
                }
            }
        }

        if ($inline) {
            foreach (self::EXIF_KEYS as $key) {
                if (isset($inline[$key]) && $inline[$key] !== null) {
                    $exif[$key] = $inline[$key];
                }
            }
        }

        return $exif;
    }

    private function extensionFor(string $path, string $mimeType): string
    {
        return match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/heic' => 'heic',
            'image/heif' => 'heif',
            'video/mp4' => 'mp4',
            'video/quicktime' => 'mov',
            default => pathinfo($path, PATHINFO_EXTENSION) ?: 'jpg',
        };
    }

    private function throwMappedValidationException(Response $response, bool $isLegacySingle): never
    {
        $apiErrors = $response->json('errors');

        if (is_array($apiErrors) && $apiErrors !== []) {
            $flattened = [];
            foreach ($apiErrors as $field => $messages) {
                $key = $this->mapErrorField((string) $field, $isLegacySingle);
                $flattened[$key] = is_array($messages) ? [(string) ($messages[0] ?? '')] : [(string) $messages];
            }
            throw ValidationException::withMessages($flattened);
        }

        throw ValidationException::withMessages([
            $isLegacySingle ? 'media_path' : 'media_paths.0' => $response->json('message', __('Failed to create post')),
        ]);
    }

    private function mapErrorField(string $field, bool $isLegacySingle): string
    {
        if ($field === 'media') {
            return $isLegacySingle ? 'media_path' : 'media_paths.0';
        }

        // External API returns errors like `media.0` / `media.0.foo` — map to
        // `media_paths.0` so the client can flag the correct slide.
        if (str_starts_with($field, 'media.')) {
            return 'media_paths.'.substr($field, strlen('media.'));
        }

        return $field;
    }
}
