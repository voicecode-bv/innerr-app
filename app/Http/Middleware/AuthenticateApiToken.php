<?php

namespace App\Http\Middleware;

use App\Http\Controllers\Auth\Concerns\HandlesAuthenticatedSession;
use App\Services\ApiClient;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    use HandlesAuthenticatedSession;

    public function __construct(protected ApiClient $apiClient) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && $request->user()->api_user_id) {
            return $next($request);
        }

        $bearer = $request->bearerToken();

        if ($bearer !== null && $bearer !== '') {
            $this->apiClient->storeToken($bearer);
        }

        if (! $this->apiClient->hasToken()) {
            return $this->unauthorized();
        }

        $result = $this->apiClient->validateToken();

        if (! ($result['valid'] ?? false) || ! isset($result['user'])) {
            // A transient upstream failure must not surface as 401: the client
            // wipes its token on 401, which would log out a still-valid user.
            // Return 503 so the request can be retried without losing the token.
            if (($result['status'] ?? 'invalid') === 'unreachable') {
                return $this->serviceUnavailable();
            }

            return $this->unauthorized();
        }

        // Reuse the same rehydration the bootstrap pad uses so both auth entry
        // points produce an identical local user mirror (keyed on api_user_id,
        // including onboarded_at/feed_layout/email_verified_at and conflict
        // cleanup) instead of a divergent, slimmed-down copy.
        $this->syncLocalUser($result['user']);

        $user = Auth::user();

        if ($user?->locale) {
            app()->setLocale($user->locale);
        }

        return $next($request);
    }

    protected function unauthorized(): JsonResponse
    {
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }

    protected function serviceUnavailable(): JsonResponse
    {
        return response()->json(['message' => 'Service temporarily unavailable.'], 503);
    }
}
