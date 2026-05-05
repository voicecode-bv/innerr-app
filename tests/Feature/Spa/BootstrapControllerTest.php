<?php

use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns guest payload when not authenticated', function () {
    $response = $this->getJson('/api/spa/bootstrap');

    $response->assertOk()
        ->assertJsonStructure([
            'user',
            'token',
            'locale',
            'api_base',
            'social_auth_urls' => ['google', 'apple'],
        ])
        ->assertJson(['user' => null, 'token' => null]);
});

it('skips validateToken call when user has no stored token', function () {
    $user = User::factory()->create();

    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('hasToken')->andReturn(false);
    $client->shouldNotReceive('validateToken');
    $client->shouldReceive('getToken')->andReturn(null);
    $this->app->instance(ApiClient::class, $client);

    $response = $this->actingAs($user)->getJson('/api/spa/bootstrap');

    $response->assertOk()->assertJsonPath('user.username', $user->username);
});

it('keeps existing local user fields when validateToken fails', function () {
    $user = User::factory()->create([
        'avatar' => 'https://existing.example.com/a.jpg',
    ]);

    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('hasToken')->andReturn(true);
    $client->shouldReceive('validateToken')->andReturn(['valid' => false]);
    $client->shouldReceive('getToken')->andReturn('expired-token');
    $this->app->instance(ApiClient::class, $client);

    $response = $this->actingAs($user)->getJson('/api/spa/bootstrap');

    $response->assertOk()->assertJsonPath('user.avatar', 'https://existing.example.com/a.jpg');
});

it('returns authenticated user payload with token mirror', function () {
    $user = User::factory()->create([
        'api_user_id' => '550e8400-e29b-41d4-a716-446655440042',
        'name' => 'Jane Doe',
        'username' => 'jane',
        'email' => 'jane@example.com',
        'locale' => 'en',
    ]);

    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('hasToken')->andReturn(true);
    $client->shouldReceive('validateToken')->andReturn([
        'valid' => true,
        'user' => [
            'avatar' => null,
            'bio' => null,
            'locale' => 'en',
            'onboarded_at' => null,
        ],
    ]);
    $client->shouldReceive('getToken')->andReturn('jwt-token');
    $this->app->instance(ApiClient::class, $client);

    $response = $this->actingAs($user)->getJson('/api/spa/bootstrap');

    $response->assertOk()
        ->assertJsonPath('user.username', 'jane')
        ->assertJsonPath('user.id', '550e8400-e29b-41d4-a716-446655440042')
        ->assertJsonPath('token', 'jwt-token');
});
