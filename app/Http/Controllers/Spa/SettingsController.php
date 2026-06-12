<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Controller;
use App\Services\ApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

/**
 * BFF-only endpoints for settings — only the file-upload paths remain here.
 * All other settings (bio, tags, notifications, default circles, account
 * export/delete, locale) go from the SPA directly to the external API.
 */
class SettingsController extends Controller
{
    public function __construct(protected ApiClient $apiClient) {}

    public function updateAvatar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'avatar_path' => ['required_without:avatar_data', 'nullable', 'string'],
            'avatar_data' => ['required_without:avatar_path', 'nullable', 'string'],
        ]);

        if (! empty($validated['avatar_data'])) {
            $contents = base64_decode($validated['avatar_data'], true);

            if ($contents === false || $contents === '') {
                throw ValidationException::withMessages(['avatar_data' => __('Invalid image data.')]);
            }

            if (strlen($contents) > 20 * 1024 * 1024) {
                throw ValidationException::withMessages(['avatar_data' => __('Image is too large.')]);
            }

            $mimeType = 'image/jpeg';
            $extension = 'jpg';
            $errorField = 'avatar_data';
        } else {
            $path = $validated['avatar_path'];

            if (! file_exists($path)) {
                throw ValidationException::withMessages(['avatar_path' => __('Image file not found.')]);
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
            $errorField = 'avatar_path';
        }

        $response = $this->apiClient->authenticated()
            ->attach('avatar', $contents, 'avatar.'.$extension, ['Content-Type' => $mimeType])
            ->post('/profile/avatar');

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                $errorField => $response->json('message', __('Failed to upload photo')),
            ]);
        }

        $avatarUrl = $response->json('user.avatar');
        $request->user()->update(['avatar' => $avatarUrl]);

        return response()->json(['avatar' => $avatarUrl]);
    }
}
