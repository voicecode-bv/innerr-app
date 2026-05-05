<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Auth\Concerns\HandlesAuthenticatedSession;
use App\Http\Controllers\Controller;
use App\Services\ApiClient;
use App\Services\TokenStore\TokenStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BootstrapController extends Controller
{
    use HandlesAuthenticatedSession;

    public function __construct(protected ApiClient $apiClient, protected TokenStore $tokenStore) {}

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $apiBase = rtrim((string) config('api-client.base_url'), '/');

        // Rehydrate sessie vanuit een Bearer-token dat de SPA in de Authorization
        // header meestuurt (token komt uit Keychain/SecureStorage). Hiermee blijft
        // de gebruiker ingelogd zelfs als de Laravel-session is verlopen.
        if (! $user) {
            $bearer = $request->bearerToken();
            if ($bearer && (! $this->apiClient->hasToken() || $this->apiClient->getToken() !== $bearer)) {
                $this->tokenStore->set($bearer);
            }
            if ($this->apiClient->hasToken()) {
                $result = $this->apiClient->validateToken();
                if (($result['valid'] ?? false) && isset($result['user'])) {
                    $this->syncLocalUser($result['user']);
                    $user = Auth::user();
                } else {
                    // Ongeldig token — wis 'm zodat we 'm niet opnieuw proberen.
                    $this->tokenStore->delete();
                }
            }
        }

        // Sync lokaal user-mirror met externe API (avatar/bio/locale/onboarded_at
        // kunnen via directe SPA→API calls zijn gewijzigd zonder dat de BFF het ziet).
        if ($user && $this->apiClient->hasToken()) {
            $result = $this->apiClient->validateToken();
            if (($result['valid'] ?? false) && isset($result['user'])) {
                $user->forceFill([
                    'avatar' => $result['user']['avatar'] ?? $user->avatar,
                    'bio' => $result['user']['bio'] ?? $user->bio,
                    'locale' => $result['user']['locale'] ?? $user->locale,
                    'onboarded_at' => $result['user']['onboarded_at'] ?? $user->onboarded_at,
                ])->save();
                $user->refresh();
            }
        }

        return response()->json([
            'user' => $user ? [
                'id' => $user->api_user_id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'avatar' => $user->avatar,
                'bio' => $user->bio,
                'locale' => $user->locale,
                'onboarded' => $user->onboarded_at !== null,
            ] : null,
            'token' => $user ? $this->apiClient->getToken() : null,
            'locale' => app()->getLocale(),
            'api_base' => $apiBase,
            'social_auth_urls' => [
                'google' => $apiBase.'/oauth/google/redirect',
                'apple' => $apiBase.'/oauth/apple/redirect',
            ],
        ]);
    }
}
