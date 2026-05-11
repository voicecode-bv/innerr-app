<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Auth\Concerns\HandlesAuthenticatedSession;
use App\Http\Controllers\Controller;
use App\Jobs\SyncDeviceInfo;
use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Native\Mobile\Edge\Edge;

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
            'user' => $this->presentUser(Auth::user()),
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

        return response()->json([
            'user' => $this->presentUser(Auth::user()),
            'token' => $this->apiClient->getToken(),
            'redirect_to' => Auth::user()?->onboarded_at !== null ? '/' : '/onboarding/intro',
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

        Edge::clear();

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function presentUser(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        return [
            'id' => $user->api_user_id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'avatar' => $user->avatar,
            'bio' => $user->bio,
            'locale' => $user->locale,
            'onboarded' => $user->onboarded_at !== null,
        ];
    }

    protected function resolveRedirect(): string
    {
        if (Auth::user()?->onboarded_at !== null) {
            return '/';
        }

        $circles = $this->apiClient->cachedCircles();

        return $circles === [] ? '/onboarding/intro' : '/';
    }
}
