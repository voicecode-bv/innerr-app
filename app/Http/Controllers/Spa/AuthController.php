<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Auth\Concerns\HandlesAuthenticatedSession;
use App\Http\Controllers\Controller;
use App\Jobs\SyncDeviceInfo;
use App\Services\ApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use HandlesAuthenticatedSession;

    public function __construct(protected ApiClient $apiClient) {}

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $result = $this->apiClient->login($validated['email'], $validated['password']);

        if (! $result['success']) {
            throw ValidationException::withMessages([
                'email' => $result['message'],
            ]);
        }

        $this->syncLocalUser($result['user']);

        SyncDeviceInfo::dispatch();

        $this->primeSettingsCache($this->apiClient);

        return response()->json([
            'user' => $this->presentUser(Auth::user(), $result['user']),
            'token' => $this->apiClient->getToken(),
            'redirect_to' => $this->resolveRedirect(),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'terms_accepted' => ['accepted'],
        ]);

        $result = $this->apiClient->register(
            $validated['name'],
            $validated['username'],
            $validated['email'],
            $validated['password'],
        );

        if (! $result['success']) {
            if (! empty($result['errors'])) {
                throw ValidationException::withMessages($result['errors']);
            }

            throw ValidationException::withMessages([
                'email' => $result['message'] ?? __('Registration failed'),
            ]);
        }

        $this->syncLocalUser($result['user']);

        SyncDeviceInfo::dispatch();

        $this->primeSettingsCache($this->apiClient);

        $this->bootstrapNewAccount();

        return response()->json([
            'user' => $this->presentUser(Auth::user(), $result['user']),
            'token' => $this->apiClient->getToken(),
            'redirect_to' => $this->resolveRedirect(),
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $result = $this->apiClient->sendPasswordResetLink($validated['email']);

        if (! $result['success']) {
            if (! empty($result['errors'])) {
                throw ValidationException::withMessages($result['errors']);
            }

            throw ValidationException::withMessages([
                'email' => $result['message'] ?? __('Could not send password reset link'),
            ]);
        }

        return response()->json([
            'message' => $result['message'] ?? __('We have emailed your password reset link'),
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $result = $this->apiClient->resetPassword(
            $validated['email'],
            $validated['token'],
            $validated['password'],
        );

        if (! $result['success']) {
            if (! empty($result['errors'])) {
                throw ValidationException::withMessages($result['errors']);
            }

            throw ValidationException::withMessages([
                'email' => $result['message'] ?? __('Could not reset password'),
            ]);
        }

        return response()->json([
            'message' => $result['message'] ?? __('Your password has been reset'),
        ]);
    }

    public function logout(): JsonResponse
    {
        $user = Auth::user();

        $this->apiClient->logout();

        Auth::logout();

        $user?->delete();

        Cache::forget(ApiClient::circlesCacheKey());
        Cache::forget('unread_notification_count');

        request()->session()->invalidate();
        request()->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    protected function resolveRedirect(): string
    {
        // Verse accounts verifiëren eerst hun e-mail; daarna stuurt de SPA-router
        // zelf door (inclusief het hervatten van een halve onboarding), dus alle
        // overige gevallen landen gewoon op '/'.
        return Auth::user()?->email_verified_at === null ? '/verify-email' : '/';
    }

    /**
     * Richt een verse account in via de API: maak de standaard "Familie"-kring
     * aan en markeer die meteen als standaardkring voor nieuwe posts, zodat
     * delen direct werkt zonder eerst langs de instellingen te moeten.
     * Best-effort: faalt een call, dan blijft registratie geslaagd en vangt
     * de onboarding-flow de rest op.
     */
    protected function bootstrapNewAccount(): void
    {
        try {
            $response = $this->apiClient->post('/circles', ['name' => __('Family')]);

            $circleId = $response->json('data.id');

            if (is_string($circleId) && $circleId !== '') {
                $this->apiClient->put('/default-circles', ['circle_ids' => [$circleId]]);
            }
        } catch (\Throwable $e) {
            report($e);
        }

        Cache::forget(ApiClient::circlesCacheKey());
    }
}
