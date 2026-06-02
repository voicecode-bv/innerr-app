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
                } elseif (($result['status'] ?? 'invalid') === 'invalid') {
                    // Alleen bij een definitieve afwijzing wissen. Bij een
                    // transient API-fout (unreachable) laten we het token staan
                    // zodat een volgende bootstrap kan herstellen i.p.v. de
                    // gebruiker onnodig uit te loggen.
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
                    'feed_layout' => $result['user']['feed_layout'] ?? $user->feed_layout,
                    'onboarded_at' => $result['user']['onboarded_at'] ?? $user->onboarded_at,
                    'email_verified_at' => $result['user']['email_verified_at'] ?? $user->email_verified_at,
                ])->save();
                $user->refresh();
            }
        }

        return response()->json([
            'user' => $this->presentUser($user),
            'token' => $user ? $this->apiClient->getToken() : null,
            'locale' => app()->getLocale(),
            'api_base' => $apiBase,
            'app_version' => (string) config('nativephp.version'),
            'social_auth_urls' => [
                'google' => $apiBase.'/oauth/google/redirect',
                'apple' => $apiBase.'/oauth/apple/redirect',
            ],
        ]);
    }
}
