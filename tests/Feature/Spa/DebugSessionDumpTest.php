<?php

use App\Models\User;
use App\Services\TokenStore\TokenStore;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns a guest dump when no session user is present', function () {
    $tokenStore = Mockery::mock(TokenStore::class)->shouldIgnoreMissing();
    $tokenStore->shouldReceive('has')->andReturn(false);
    $this->app->instance(TokenStore::class, $tokenStore);

    $this->getJson('/api/spa/debug/session-dump')
        ->assertOk()
        ->assertJsonStructure(['session_id', 'session', 'server_token', 'auth_status', 'user'])
        ->assertJson([
            'auth_status' => 'guest',
            'server_token' => null,
            'user' => null,
        ]);
});

it('returns the authenticated user and held token in the dump', function () {
    $tokenStore = Mockery::mock(TokenStore::class)->shouldIgnoreMissing();
    $tokenStore->shouldReceive('has')->andReturn(true);
    $tokenStore->shouldReceive('get')->andReturn('held-token');
    $this->app->instance(TokenStore::class, $tokenStore);

    $user = User::factory()->create([
        'api_user_id' => '550e8400-e29b-41d4-a716-446655440010',
        'username' => 'dumpuser',
        'email' => 'dump@example.com',
    ]);

    // The dump must never expose another user's data: only the caller's own
    // session is read, so an authenticated request mirrors that user.
    $this->actingAs($user)
        ->getJson('/api/spa/debug/session-dump')
        ->assertOk()
        ->assertJson([
            'auth_status' => 'authenticated',
            'server_token' => 'held-token',
            'user' => [
                'id' => '550e8400-e29b-41d4-a716-446655440010',
                'username' => 'dumpuser',
                'email' => 'dump@example.com',
            ],
        ]);
});
