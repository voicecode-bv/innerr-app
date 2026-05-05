<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PostActionController;
use App\Services\ApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

/**
 * BFF-only endpoint voor post-creation — NativePhp Camera levert een file://
 * pad dat alleen serverside leesbaar is en als multipart naar de externe API
 * moet (WKWebView strips multipart-bodies). Ook EXIF-sidecar forwarden voor
 * cropped beelden.
 */
class PostsController extends Controller
{
    public function __construct(protected ApiClient $apiClient) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'media_path' => ['required', 'string'],
            'caption' => ['nullable', 'string', 'max:2200'],
            'location' => ['nullable', 'string', 'max:255'],
            'circle_ids' => ['required', 'array'],
            'circle_ids.*' => ['uuid'],
            'tag_ids' => ['nullable', 'array'],
            'tag_ids.*' => ['uuid'],
            'person_ids' => ['nullable', 'array'],
            'person_ids.*' => ['uuid'],
        ]);

        $path = $validated['media_path'];

        if (! file_exists($path)) {
            throw ValidationException::withMessages(['media_path' => __('Media file not found.')]);
        }

        $data = [
            'caption' => $validated['caption'] ?? '',
            'location' => $validated['location'] ?? '',
            'circle_ids' => $validated['circle_ids'],
            'tag_ids' => $validated['tag_ids'] ?? [],
            'person_ids' => $validated['person_ids'] ?? [],
        ];

        $sidecarPath = $path.'.exif.json';

        if (file_exists($sidecarPath)) {
            $exif = json_decode((string) file_get_contents($sidecarPath), true) ?? [];

            foreach (['taken_at', 'latitude', 'longitude'] as $key) {
                if (isset($exif[$key]) && $exif[$key] !== null) {
                    $data[$key] = $exif[$key];
                }
            }
        }

        $mimeType = File::mimeType($path);
        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/heic' => 'heic',
            'image/heif' => 'heif',
            'video/mp4' => 'mp4',
            'video/quicktime' => 'mov',
            default => pathinfo($path, PATHINFO_EXTENSION) ?: 'jpg',
        };

        $filename = pathinfo($path, PATHINFO_FILENAME).'.'.$extension;

        $response = $this->apiClient->authenticated()
            ->attach('media', file_get_contents($path), $filename, ['Content-Type' => $mimeType])
            ->post('/posts', $data);

        if (str_starts_with($path, PostActionController::croppedMediaDirectory())) {
            @unlink($path);
            @unlink($sidecarPath);
        }

        if (! $response->successful()) {
            // 429 doorrijzen mét Retry-After zodat de client een nette
            // "probeer over X seconden opnieuw" melding kan tonen. Verstoppen
            // achter een 422 zou betekenen dat de spam-throttle voor de
            // gebruiker onzichtbaar blijft en de upload "niet werkt".
            if ($response->status() === 429) {
                return response()->json([
                    'message' => $response->json('message', __('Too many requests. Please try again shortly.')),
                ], 429, array_filter([
                    'Retry-After' => $response->header('Retry-After'),
                ]));
            }

            $apiErrors = $response->json('errors');

            if (is_array($apiErrors) && $apiErrors !== []) {
                $flattened = [];
                foreach ($apiErrors as $field => $messages) {
                    $key = $field === 'media' ? 'media_path' : $field;
                    $flattened[$key] = is_array($messages) ? [(string) ($messages[0] ?? '')] : [(string) $messages];
                }
                throw ValidationException::withMessages($flattened);
            }

            throw ValidationException::withMessages([
                'media_path' => $response->json('message', __('Failed to create post')),
            ]);
        }

        return response()->json(['data' => $this->apiClient->proxyMediaUrls($response->json('data'))], 201);
    }
}
