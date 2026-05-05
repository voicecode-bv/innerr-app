<?php

use App\Http\Controllers\Auth\Concerns\HandlesAuthenticatedSession;
use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;

uses(RefreshDatabase::class);

const API_USER_ID = '550e8400-e29b-41d4-a716-446655440042';
const STALE_API_USER_ID = '550e8400-e29b-41d4-a716-446655440099';

/**
 * Anonymous test-class to expose the trait's protected methods.
 */
beforeEach(function () {
    $this->subject = new class
    {
        use HandlesAuthenticatedSession {
            syncLocalUser as public;
            primeSettingsCache as public;
        }
    };
});

it('creates a new local user when none exists', function () {
    $this->subject->syncLocalUser([
        'id' => API_USER_ID,
        'name' => 'Jane',
        'username' => 'jane',
        'email' => 'jane@example.com',
        'avatar' => 'https://example.com/a.jpg',
        'bio' => 'Hello',
        'locale' => 'nl',
        'onboarded_at' => now()->toIso8601String(),
    ]);

    $this->assertDatabaseHas('users', [
        'api_user_id' => API_USER_ID,
        'username' => 'jane',
        'locale' => 'nl',
    ]);
    expect(Auth::id())->toBe(User::where('api_user_id', API_USER_ID)->value('id'));
});

it('updates an existing local user when api_user_id matches', function () {
    User::factory()->create([
        'api_user_id' => API_USER_ID,
        'name' => 'Old Name',
        'email' => 'old@example.com',
        'username' => 'old',
        'locale' => 'en',
    ]);

    $this->subject->syncLocalUser([
        'id' => API_USER_ID,
        'name' => 'New Name',
        'username' => 'new',
        'email' => 'new@example.com',
        'avatar' => null,
        'bio' => null,
        'locale' => 'nl',
        'onboarded_at' => null,
    ]);

    expect(User::where('api_user_id', API_USER_ID)->count())->toBe(1);
    $user = User::where('api_user_id', API_USER_ID)->first();
    expect($user->name)->toBe('New Name');
    expect($user->email)->toBe('new@example.com');
    expect($user->locale)->toBe('nl');
    expect($user->onboarded_at)->toBeNull();
});

it('removes stale local users with same email but different api_user_id', function () {
    User::factory()->create([
        'api_user_id' => STALE_API_USER_ID,
        'email' => 'jane@example.com',
        'username' => 'jane',
    ]);

    $this->subject->syncLocalUser([
        'id' => API_USER_ID,
        'name' => 'Jane',
        'username' => 'jane',
        'email' => 'jane@example.com',
        'avatar' => null,
        'bio' => null,
        'locale' => 'en',
        'onboarded_at' => null,
    ]);

    expect(User::where('api_user_id', STALE_API_USER_ID)->count())->toBe(0);
    expect(User::where('api_user_id', API_USER_ID)->count())->toBe(1);
});

it('prefers session locale over API locale when both present', function () {
    session(['locale' => 'nl']);

    $this->subject->syncLocalUser([
        'id' => API_USER_ID,
        'name' => 'Jane',
        'username' => 'jane',
        'email' => 'jane@example.com',
        'avatar' => null,
        'bio' => null,
        'locale' => 'en',
        'onboarded_at' => null,
    ]);

    expect(User::where('api_user_id', API_USER_ID)->value('locale'))->toBe('nl');
});

it('primeSettingsCache is a no-op when not authenticated', function () {
    $client = Mockery::mock(ApiClient::class);
    $client->shouldNotReceive('cachedCircles');

    $this->subject->primeSettingsCache($client);

    expect(true)->toBeTrue();
});

it('primeSettingsCache calls cachedCircles when authenticated', function () {
    $user = User::factory()->create();
    Auth::login($user);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('cachedCircles')->once()->andReturn([]);

    $this->subject->primeSettingsCache($client);
});
