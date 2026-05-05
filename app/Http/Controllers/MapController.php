<?php

namespace App\Http\Controllers;

use App\Services\ApiClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Photo-map JSON proxies — PhotoMap component fetcht zonder bearer-headers,
 * dus session-cookie auth via deze BFF is hier het simpelste pad.
 */
class MapController extends Controller
{
    public function photos(Request $request, ApiClient $apiClient): JsonResponse
    {
        return $this->proxyPhotoMap($request, $apiClient, '/photos/map');
    }

    public function profilePhotos(string $username, Request $request, ApiClient $apiClient): JsonResponse
    {
        return $this->proxyPhotoMap($request, $apiClient, "/profiles/{$username}/photos/map");
    }

    public function circlePhotos(string $circle, Request $request, ApiClient $apiClient): JsonResponse
    {
        return $this->proxyPhotoMap($request, $apiClient, "/circles/{$circle}/photos/map");
    }

    private function proxyPhotoMap(Request $request, ApiClient $apiClient, string $path): JsonResponse
    {
        $validated = $request->validate([
            'bbox' => ['required', 'string'],
            'media_type' => ['nullable', 'string', 'in:image,video,all'],
        ]);

        $query = http_build_query(array_filter([
            'bbox' => $validated['bbox'],
            'media_type' => $validated['media_type'] ?? null,
        ]));

        try {
            $response = $apiClient->get($path.'?'.$query);
        } catch (ConnectionException) {
            return response()->json(['type' => 'FeatureCollection', 'features' => [], 'truncated' => false], 200);
        }

        if ($response->failed()) {
            return response()->json(
                ['type' => 'FeatureCollection', 'features' => [], 'truncated' => false],
                $response->status(),
            );
        }

        return response()->json($apiClient->proxyMediaUrls($response->json()));
    }
}
