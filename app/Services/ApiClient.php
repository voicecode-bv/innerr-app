<?php

namespace App\Services;

use App\Services\TokenStore\TokenStore;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ApiClient
{
    public function __construct(protected TokenStore $tokenStore) {}

    public function getToken(): ?string
    {
        return $this->tokenStore->get();
    }

    public function storeToken(string $token): bool
    {
        return $this->tokenStore->set($token);
    }

    public function clearToken(): bool
    {
        return $this->tokenStore->delete();
    }

    public function hasToken(): bool
    {
        return $this->tokenStore->has();
    }

    /**
     * @return array{success: bool, user?: array<string, mixed>, message?: string}
     */
    public function login(string $email, string $password): array
    {
        try {
            $response = $this->request()
                ->post('/auth/login', [
                    'email' => $email,
                    'password' => $password,
                    'device_name' => 'innerr-mobile',
                ]);
        } catch (ConnectionException) {
            return ['success' => false, 'message' => __('Could not connect to the server')];
        }

        if ($response->successful()) {
            $data = $response->json();
            $this->storeToken($data['token']);

            return ['success' => true, 'user' => $data['user']];
        }

        return [
            'success' => false,
            'message' => $response->json('message', __('Invalid credentials')),
        ];
    }

    /**
     * @return array{success: bool, user?: array<string, mixed>, errors?: array<string, mixed>, message?: string}
     */
    public function register(string $name, string $username, string $email, string $password): array
    {
        try {
            $response = $this->request()
                ->post('/auth/register', [
                    'name' => $name,
                    'username' => $username,
                    'email' => $email,
                    'password' => $password,
                    'password_confirmation' => $password,
                    'device_name' => 'innerr-mobile',
                ]);
        } catch (ConnectionException) {
            return ['success' => false, 'message' => __('Could not connect to the server')];
        }

        if ($response->successful()) {
            $data = $response->json();
            $this->storeToken($data['token']);

            return ['success' => true, 'user' => $data['user']];
        }

        if ($response->status() === 422) {
            return [
                'success' => false,
                'errors' => $response->json('errors', []),
                'message' => $response->json('message', __('Validation failed')),
            ];
        }

        return [
            'success' => false,
            'message' => $response->json('message', __('Registration failed')),
        ];
    }

    /**
     * @return array{success: bool, message?: string, errors?: array<string, mixed>}
     */
    public function sendPasswordResetLink(string $email): array
    {
        try {
            $response = $this->request()
                ->post('/auth/forgot-password', ['email' => $email]);
        } catch (ConnectionException) {
            return ['success' => false, 'message' => __('Could not connect to the server')];
        }

        if ($response->successful()) {
            return ['success' => true, 'message' => $response->json('message')];
        }

        if ($response->status() === 422) {
            return [
                'success' => false,
                'errors' => $response->json('errors', []),
                'message' => $response->json('message', __('Validation failed')),
            ];
        }

        return [
            'success' => false,
            'message' => $response->json('message', __('Could not send password reset link')),
        ];
    }

    /**
     * @return array{success: bool, message?: string, errors?: array<string, mixed>}
     */
    public function resetPassword(string $email, string $token, string $password): array
    {
        try {
            $response = $this->request()
                ->post('/auth/reset-password', [
                    'email' => $email,
                    'token' => $token,
                    'password' => $password,
                    'password_confirmation' => $password,
                ]);
        } catch (ConnectionException) {
            return ['success' => false, 'message' => __('Could not connect to the server')];
        }

        if ($response->successful()) {
            return ['success' => true, 'message' => $response->json('message')];
        }

        if ($response->status() === 422) {
            return [
                'success' => false,
                'errors' => $response->json('errors', []),
                'message' => $response->json('message', __('Validation failed')),
            ];
        }

        return [
            'success' => false,
            'message' => $response->json('message', __('Could not reset password')),
        ];
    }

    /**
     * Validate the stored token against the external API.
     *
     * The `status` distinguishes a genuinely rejected token (`invalid`) from a
     * transient upstream failure (`unreachable`). Only `invalid` clears the
     * token; a 5xx/429/timeout must never wipe a token that is still valid,
     * otherwise an API hiccup forces every user to log in again.
     *
     * @return array{valid: bool, status: 'valid'|'invalid'|'unreachable', user?: array<string, mixed>}
     */
    public function validateToken(): array
    {
        if (! $this->hasToken()) {
            return ['valid' => false, 'status' => 'invalid'];
        }

        try {
            $response = $this->authenticated()->get('/auth/me');
        } catch (ConnectionException) {
            // Network-level failure: the token may still be valid, keep it.
            return ['valid' => false, 'status' => 'unreachable'];
        }

        if ($response->successful()) {
            return ['valid' => true, 'status' => 'valid', 'user' => $response->json('user')];
        }

        // Only a definitive auth rejection means the token is no longer usable.
        if ($response->status() === 401 || $response->status() === 403) {
            $this->clearToken();

            return ['valid' => false, 'status' => 'invalid'];
        }

        // 5xx/429/etc.: transient upstream problem, preserve the token.
        return ['valid' => false, 'status' => 'unreachable'];
    }

    public function logout(): void
    {
        if ($this->hasToken()) {
            $this->authenticated()->post('/auth/logout');
        }

        $this->clearToken();
    }

    public function get(string $path): Response
    {
        return $this->authenticated()->get($path);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function post(string $path, array $data = []): Response
    {
        return $this->authenticated()->post($path, $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function put(string $path, array $data = []): Response
    {
        return $this->authenticated()->put($path, $data);
    }

    public function delete(string $path): Response
    {
        return $this->authenticated()->delete($path);
    }

    public function request(): PendingRequest
    {
        $request = Http::baseUrl(config('api-client.base_url'))
            ->timeout(config('api-client.timeout'))
            ->acceptJson()
            ->withHeaders(['Accept-Language' => app()->getLocale()]);

        if (app()->isLocal()) {
            $request->withoutVerifying();
        }

        return $request;
    }

    public function authenticated(): PendingRequest
    {
        return $this->request()->withToken($this->getToken());
    }

    public const SETTINGS_CACHE_TTL = 300;

    public static function circlesCacheKey(): string
    {
        return 'circles';
    }

    /**
     * Fetch and cache the current user's circles. Used door Spa\AuthController
     * om na login te beslissen of de SPA naar onboarding of de feed gaat.
     *
     * @return array<int, array<string, mixed>>
     */
    public function cachedCircles(): array
    {
        return Cache::remember(
            self::circlesCacheKey(),
            self::SETTINGS_CACHE_TTL,
            function () {
                try {
                    $response = $this->get('/circles');
                } catch (ConnectionException) {
                    return [];
                }

                return $response->successful()
                    ? $this->proxyMediaUrls($response->json('data')) ?? []
                    : [];
            },
        );
    }

    /**
     * Rewrite signed API media URLs to go through the local caching proxy.
     *
     * @param  array<string, mixed>|null  $data
     * @return array<string, mixed>|null
     */
    public function proxyMediaUrls(?array $data): ?array
    {
        if ($data === null) {
            return null;
        }

        $json = json_encode($data);

        $apiHost = parse_url(config('api-client.base_url'), PHP_URL_HOST);

        $json = preg_replace_callback(
            '#https?://'.preg_quote($apiHost, '#').'/api/media/[^"\\\\]+#',
            fn ($matches) => url('/media-proxy?url='.urlencode($matches[0])),
            $json,
        );

        return json_decode($json, true);
    }
}
