<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Controller;
use App\Services\ApiClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

/**
 * BFF-only endpoint for circle-photo upload — NativePhp Camera delivers a
 * file:// path that is only readable server-side.
 */
class CircleMediaController extends Controller
{
    public function __construct(protected ApiClient $apiClient) {}

    public function updatePhoto(Request $request, string $circle): JsonResponse
    {
        $validated = $request->validate([
            'photo_path' => ['required_without:photo_data', 'nullable', 'string'],
            'photo_data' => ['required_without:photo_path', 'nullable', 'string'],
        ]);

        if (! empty($validated['photo_data'])) {
            $contents = base64_decode($validated['photo_data'], true);

            if ($contents === false || $contents === '') {
                throw ValidationException::withMessages(['photo_data' => __('Invalid image data.')]);
            }

            if (strlen($contents) > 20 * 1024 * 1024) {
                throw ValidationException::withMessages(['photo_data' => __('Image is too large.')]);
            }

            $mimeType = 'image/jpeg';
            $extension = 'jpg';
            $errorField = 'photo_data';
        } else {
            $path = $validated['photo_path'];

            if (! file_exists($path)) {
                throw ValidationException::withMessages(['photo_path' => __('Image file not found.')]);
            }

            $contents = file_get_contents($path);
            $mimeType = File::mimeType($path);
            $extension = match ($mimeType) {
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/heic' => 'heic',
                'image/heif' => 'heif',
                default => pathinfo($path, PATHINFO_EXTENSION) ?: 'jpg',
            };
            $errorField = 'photo_path';
        }

        try {
            $response = $this->apiClient->authenticated()
                ->attach('photo', $contents, 'circle-photo.'.$extension, ['Content-Type' => $mimeType])
                ->post("/circles/{$circle}/photo");
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['photo' => __('Could not connect to the server')]);
        }

        if ($response->failed()) {
            throw ValidationException::withMessages([
                $errorField => $response->json('errors.photo.0') ?? $response->json('message', __('Failed to upload photo')),
            ]);
        }

        Cache::forget(ApiClient::circlesCacheKey());

        return response()->json([
            'ok' => true,
            'photo' => $response->json('data.photo') ?? $response->json('photo'),
        ]);
    }
}
