<?php

use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

it('rehydrates a full local user mirror when authenticating via the bearer fallback', function () {
    Route::middleware(['web', 'auth.api'])->get('/api/_test/api-token', fn () => response()->json(['ok' => true]));

    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('hasToken')->andReturn(true);
    $client->shouldReceive('validateToken')->andReturn([
        'valid' => true,
        'user' => [
            'id' => '550e8400-e29b-41d4-a716-446655440777',
            'name' => 'Fallback User',
            'username' => 'fallback',
            'email' => 'fallback@example.com',
            'avatar' => null,
            'bio' => null,
            'locale' => 'en',
            'feed_layout' => 'masonry',
            'onboarded_at' => '2026-01-02T03:04:05Z',
            'email_verified_at' => '2026-01-01T00:00:00Z',
        ],
    ]);
    $this->app->instance(ApiClient::class, $client);

    $this->withToken('a-valid-bearer')->getJson('/api/_test/api-token')->assertOk();

    // The fallback path must produce the same full mirror as the bootstrap path:
    // keyed on api_user_id and including the fields the old middleware dropped.
    $user = User::query()->where('api_user_id', '550e8400-e29b-41d4-a716-446655440777')->first();

    expect($user)->not->toBeNull();
    expect($user->username)->toBe('fallback');
    expect($user->feed_layout)->toBe('masonry');
    expect($user->onboarded_at)->not->toBeNull();
    expect($user->email_verified_at)->not->toBeNull();
});

it('returns 503 without dropping the token on a transient upstream failure', function () {
    Route::middleware(['web', 'auth.api'])->get('/api/_test/api-token-unreachable', fn () => response()->json(['ok' => true]));

    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('hasToken')->andReturn(true);
    $client->shouldReceive('validateToken')->andReturn(['valid' => false, 'status' => 'unreachable']);
    $client->shouldNotReceive('clearToken');
    $this->app->instance(ApiClient::class, $client);

    $this->withToken('still-valid')->getJson('/api/_test/api-token-unreachable')->assertStatus(503);
});
