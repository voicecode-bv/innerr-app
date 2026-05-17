<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PostActionController;
use App\Services\ApiClient;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

/**
 * BFF-only endpoint voor post-creation — NativePhp Camera levert een file://
 * pad dat alleen serverside leesbaar is en als multipart naar de externe API
 * moet (WKWebView strips multipart-bodies).
 *
 * Ondersteunt zowel single (legacy `media_path`) als multi (`media_paths[]` +
 * optioneel `media_metadata[]`). EXIF per item komt uit `media_metadata` of
 * valt terug op de `.exif.json` sidecar naast het bestand.
 */
class PostsController extends Controller
{
    private const MAX_MEDIA_ITEMS = 10;

    private const EXIF_KEYS = ['taken_at', 'latitude', 'longitude'];

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
            'location' => ['nullable', 'string', 'max:255'],
            'circle_ids' => ['required', 'array'],
            'circle_ids.*' => ['uuid'],
            'tag_ids' => ['nullable', 'array'],
            'tag_ids.*' => ['uuid'],
            'person_ids' => ['nullable', 'array'],
            'person_ids.*' => ['uuid'],
        ]);

        // Normaliseer naar array — interne logica heeft één codepad.
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

        // Single-file pad behoudt de huidige externe API-shape (top-level
        // EXIF + single `media` veld) zodat dit blijft werken zonder dat de
        // externe API direct multi-support nodig heeft.
        if (count($paths) === 1) {
            foreach (self::EXIF_KEYS as $key) {
                if ($perItemExif[0][$key] ?? null) {
                    $data[$key] = $perItemExif[0][$key];
                }
            }
        } else {
            $data['media_metadata'] = json_encode(array_values($perItemExif));
        }

        $request = $this->apiClient->authenticated();
        $openHandles = [];

        try {
            $request = $this->attachMedia($request, $paths, $openHandles);
            $response = $request->post('/posts', $data);
        } finally {
            foreach ($openHandles as $handle) {
                if (is_resource($handle)) {
                    fclose($handle);
                }
            }
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
     * @param  list<string>  $paths
     * @param  array<int, resource>  $openHandles  collected so the caller can fclose() after the HTTP call.
     */
    private function attachMedia(PendingRequest $request, array $paths, array &$openHandles): PendingRequest
    {
        $multi = count($paths) > 1;

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

        return $request;
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

        // External API returns errors like `media.0` / `media.0.foo` — map naar
        // `media_paths.0` zodat de client de juiste slide kan markeren.
        if (str_starts_with($field, 'media.')) {
            return 'media_paths.'.substr($field, strlen('media.'));
        }

        return $field;
    }
}
