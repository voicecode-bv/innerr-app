<?php

use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

it('returns user + token + redirect on successful login', function () {
    Queue::fake();

    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('login')->once()->with('jane@example.com', 'secret123')->andReturn([
        'success' => true,
        'user' => [
            'id' => '550e8400-e29b-41d4-a716-446655440042',
            'name' => 'Jane',
            'username' => 'jane',
            'email' => 'jane@example.com',
            'avatar' => null,
            'bio' => null,
            'locale' => 'en',
            'onboarded_at' => now()->toIso8601String(),
        ],
    ]);
    $client->shouldReceive('getToken')->andReturn('jwt-token');
    $client->shouldReceive('cachedCircles')->andReturn([['id' => '550e8400-e29b-41d4-a716-446655441001', 'name' => 'Family']]);
    $this->app->instance(ApiClient::class, $client);

    $response = $this->postJson('/api/spa/auth/login', [
        'email' => 'jane@example.com',
        'password' => 'secret123',
    ]);

    $response->assertOk()
        ->assertJsonPath('user.username', 'jane')
        ->assertJsonPath('token', 'jwt-token')
        ->assertJsonPath('redirect_to', '/');

    $this->assertDatabaseHas('users', ['username' => 'jane', 'api_user_id' => '550e8400-e29b-41d4-a716-446655440042']);
    $this->assertAuthenticated();
});

it('redirects new users to onboarding when no circles exist', function () {
    Queue::fake();

    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('login')->andReturn([
        'success' => true,
        'user' => [
            'id' => '550e8400-e29b-41d4-a716-446655440042', 'name' => 'Jane', 'username' => 'jane',
            'email' => 'jane@example.com', 'avatar' => null, 'bio' => null,
            'locale' => 'en', 'onboarded_at' => null,
        ],
    ]);
    $client->shouldReceive('getToken')->andReturn('jwt-token');
    $client->shouldReceive('cachedCircles')->andReturn([]);
    $this->app->instance(ApiClient::class, $client);

    $response = $this->postJson('/api/spa/auth/login', [
        'email' => 'jane@example.com',
        'password' => 'secret123',
    ]);

    $response->assertOk()->assertJsonPath('redirect_to', '/onboarding/intro');
});

it('returns 422 with validation errors when login fails', function () {
    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('login')->andReturn([
        'success' => false,
        'message' => 'Invalid credentials',
    ]);
    $this->app->instance(ApiClient::class, $client);

    $this->postJson('/api/spa/auth/login', [
        'email' => 'jane@example.com',
        'password' => 'wrong',
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('logout clears the local user and circles cache', function () {
    $user = User::factory()->create();

    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('logout')->once();
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/auth/logout')
        ->assertOk()
        ->assertJson(['ok' => true]);

    $this->assertGuest();
    $this->assertDatabaseMissing('users', ['id' => $user->id]);
});

it('rejects logout without authentication', function () {
    $this->postJson('/api/spa/auth/logout')->assertStatus(401);
});
