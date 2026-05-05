<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Controller;
use App\Services\ApiClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

/**
 * BFF-only endpoint voor person-photo upload — NativePhp Camera levert een
 * file:// pad dat alleen serverside leesbaar is. Alle andere person-CRUD
 * gaat vanuit de SPA direct naar de externe API.
 */
class PersonsController extends Controller
{
    public function __construct(protected ApiClient $apiClient) {}

    public function updatePhoto(Request $request, string $person): JsonResponse
    {
        $validated = $request->validate([
            'photo_path' => ['required', 'string'],
        ]);

        $path = $validated['photo_path'];

        if (! file_exists($path)) {
            throw ValidationException::withMessages(['photo_path' => __('Image file not found.')]);
        }

        $mimeType = File::mimeType($path);
        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/heic' => 'heic',
            'image/heif' => 'heif',
            default => pathinfo($path, PATHINFO_EXTENSION) ?: 'jpg',
        };

        try {
            $response = $this->apiClient->authenticated()
                ->attach('avatar', file_get_contents($path), 'person-avatar.'.$extension, ['Content-Type' => $mimeType])
                ->post("/persons/{$person}/avatar");
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['photo' => __('Could not connect to the server')]);
        }

        if ($response->failed()) {
            throw ValidationException::withMessages([
                'photo' => $response->json('errors.avatar.0') ?? $response->json('message', __('Failed to upload photo')),
            ]);
        }

        return response()->json(['ok' => true]);
    }
}
