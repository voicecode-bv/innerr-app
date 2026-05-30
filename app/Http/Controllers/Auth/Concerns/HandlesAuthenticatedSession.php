<?php

namespace App\Http\Controllers\Auth\Concerns;

use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

trait HandlesAuthenticatedSession
{
    /**
     * @param  array<string, mixed>  $userData
     */
    protected function syncLocalUser(array $userData): void
    {
        User::query()
            ->where('api_user_id', '!=', $userData['id'])
            ->where(function ($query) use ($userData): void {
                $query->where('email', $userData['email'])
                    ->orWhere('username', $userData['username']);
            })
            ->delete();

        $user = User::updateOrCreate(
            ['api_user_id' => $userData['id']],
            [
                'email' => $userData['email'],
                'name' => $userData['name'],
                'username' => $userData['username'],
                'avatar' => $userData['avatar'] ?? null,
                'bio' => $userData['bio'] ?? null,
                'locale' => session('locale') ?? $userData['locale'] ?? config('app.locale'),
                'password' => 'api-managed',
            ],
        );

        $user->forceFill([
            'onboarded_at' => $userData['onboarded_at'] ?? null,
            'feed_layout' => $userData['feed_layout'] ?? null,
        ])->save();

        Auth::login($user);

        session()->regenerate();
    }

    protected function primeSettingsCache(ApiClient $apiClient): void
    {
        if (Auth::user() === null) {
            return;
        }

        try {
            Cache::forget(ApiClient::circlesCacheKey());
            $apiClient->cachedCircles();
        } catch (\Throwable $e) {
            Log::warning('Failed to prime circles cache after auth', ['error' => $e->getMessage()]);
        }
    }
}
