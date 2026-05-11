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

it('sends a password reset link via the api', function () {
    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('sendPasswordResetLink')
        ->once()
        ->with('jane@example.com')
        ->andReturn(['success' => true, 'message' => 'Link sent']);
    $this->app->instance(ApiClient::class, $client);

    $this->postJson('/api/spa/auth/forgot-password', [
        'email' => 'jane@example.com',
    ])->assertOk()->assertJsonPath('message', 'Link sent');
});

it('returns 422 when forgot-password api reports an error', function () {
    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('sendPasswordResetLink')->andReturn([
        'success' => false,
        'message' => 'Email not found',
    ]);
    $this->app->instance(ApiClient::class, $client);

    $this->postJson('/api/spa/auth/forgot-password', [
        'email' => 'unknown@example.com',
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('validates the email field on forgot-password', function () {
    $this->postJson('/api/spa/auth/forgot-password', [
        'email' => 'not-an-email',
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('resets the password via the api', function () {
    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('resetPassword')
        ->once()
        ->with('jane@example.com', 'reset-token', 'newpassword123')
        ->andReturn(['success' => true, 'message' => 'Password updated']);
    $this->app->instance(ApiClient::class, $client);

    $this->postJson('/api/spa/auth/reset-password', [
        'token' => 'reset-token',
        'email' => 'jane@example.com',
        'password' => 'newpassword123',
    ])->assertOk()->assertJsonPath('message', 'Password updated');
});

it('returns 422 when reset-password api reports validation errors', function () {
    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('resetPassword')->andReturn([
        'success' => false,
        'errors' => ['email' => ['This password reset token is invalid.']],
    ]);
    $this->app->instance(ApiClient::class, $client);

    $this->postJson('/api/spa/auth/reset-password', [
        'token' => 'bad-token',
        'email' => 'jane@example.com',
        'password' => 'newpassword123',
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('requires token, email and password on reset-password', function () {
    $this->postJson('/api/spa/auth/reset-password', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['token', 'email', 'password']);
});
