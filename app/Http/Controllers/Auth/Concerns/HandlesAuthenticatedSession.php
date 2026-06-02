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
            'email_verified_at' => $userData['email_verified_at'] ?? null,
        ])->save();

        Auth::login($user);

        session()->regenerate();
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
            'feed_layout' => $user->feed_layout,
            'onboarded' => $user->onboarded_at !== null,
            'email_verified' => $user->email_verified_at !== null,
            // Accounts that existed before verification was enforced were
            // backfilled in the API, so locally this is simply "not verified".
            'email_verification_required' => $user->email_verified_at === null,
        ];
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
