<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Auth\Concerns\HandlesAuthenticatedSession;
use App\Http\Controllers\Controller;
use App\Services\ApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BootstrapController extends Controller
{
    use HandlesAuthenticatedSession;

    public function __construct(protected ApiClient $apiClient) {}

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $apiBase = rtrim((string) config('api-client.base_url'), '/');

        // Remembers whether the external API was unreachable during this bootstrap.
        // In that case we could not confirm the user, but the token is still valid:
        // on that signal the SPA must NOT send the user to login.
        $upstreamUnreachable = false;

        // Adopt the Bearer token the SPA forwards in the Authorization header
        // (sourced from Keychain/SecureStorage) so the session can be rehydrated
        // even when the Laravel session itself has expired.
        if (! $user) {
            $bearer = $request->bearerToken();
            if ($bearer && (! $this->apiClient->hasToken() || $this->apiClient->getToken() !== $bearer)) {
                $this->apiClient->storeToken($bearer);
            }
        }

        // Validate the token a single time and reuse the result for both the
        // session rehydration and the user-mirror sync below, so a cold-start
        // bootstrap costs one upstream round-trip instead of two.
        $result = $this->apiClient->hasToken() ? $this->apiClient->validateToken() : null;
        $validatedUser = ($result['valid'] ?? false) && isset($result['user']) ? $result['user'] : null;

        // Rehydrate the session from the validated token when we have no local
        // user yet (cold start or expired Laravel session).
        if (! $user && $result !== null) {
            if ($validatedUser !== null) {
                $this->syncLocalUser($validatedUser);
                $user = Auth::user();
            } elseif (($result['status'] ?? 'invalid') === 'invalid') {
                // Only drop the token on a definitive rejection. On a transient
                // API failure (unreachable) we keep it so a later bootstrap can
                // recover instead of logging the user out unnecessarily.
                $this->apiClient->clearToken();
            } else {
                // Transient: token stays, user could not be confirmed.
                $upstreamUnreachable = true;
            }
        }

        // Sync the local user-mirror with the external API (avatar/bio/locale/
        // onboarded_at may have changed via direct SPA→API calls without the BFF
        // seeing it).
        if ($user && $validatedUser !== null) {
            $user->forceFill([
                'avatar' => $validatedUser['avatar'] ?? $user->avatar,
                'bio' => $validatedUser['bio'] ?? $user->bio,
                'locale' => $validatedUser['locale'] ?? $user->locale,
                'feed_layout' => $validatedUser['feed_layout'] ?? $user->feed_layout,
                'onboarded_at' => $validatedUser['onboarded_at'] ?? $user->onboarded_at,
                'email_verified_at' => $validatedUser['email_verified_at'] ?? $user->email_verified_at,
            ])->save();
            $user->refresh();
        }

        // Explicit auth signal for the SPA so it can distinguish "actually logged
        // out" from "temporarily unreachable". On `unreachable` the SPA keeps the
        // last known user from its snapshot instead of going to login.
        $authStatus = match (true) {
            $user !== null => 'authenticated',
            $upstreamUnreachable && $this->apiClient->hasToken() => 'unreachable',
            default => 'unauthenticated',
        };

        return response()->json([
            'user' => $this->presentUser($user, $validatedUser),
            // Return the token as long as we still hold one (also when
            // unreachable), so the SPA can keep using its Bearer.
            'token' => $this->apiClient->hasToken() ? $this->apiClient->getToken() : null,
            'auth_status' => $authStatus,
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
