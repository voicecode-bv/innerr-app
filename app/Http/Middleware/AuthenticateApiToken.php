<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\ApiClient;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
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

        $userData = $result['user'];

        $user = User::updateOrCreate(
            ['email' => $userData['email']],
            [
                'api_user_id' => $userData['id'],
                'name' => $userData['name'],
                'username' => $userData['username'],
                'avatar' => $userData['avatar'] ?? null,
                'bio' => $userData['bio'] ?? null,
                'locale' => $userData['locale'] ?? config('app.locale'),
                'password' => 'api-managed',
            ],
        );

        Auth::login($user);

        if ($user->locale) {
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
