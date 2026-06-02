<?php

use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

const VERIFY_API_USER_ID = '550e8400-e29b-41d4-a716-446655440077';

function actingVerificationUser(): User
{
    return User::factory()->create([
        'api_user_id' => VERIFY_API_USER_ID,
        'email' => 'jane@example.com',
        'username' => 'jane',
        'email_verified_at' => null,
    ]);
}

/**
 * @return array<string, mixed>
 */
function verifiedApiUser(): array
{
    return [
        'id' => VERIFY_API_USER_ID,
        'name' => 'Jane',
        'username' => 'jane',
        'email' => 'jane@example.com',
        'avatar' => null,
        'bio' => null,
        'locale' => 'en',
        'feed_layout' => null,
        'onboarded_at' => now()->toIso8601String(),
        'email_verified_at' => now()->toIso8601String(),
    ];
}

it('requires authentication', function () {
    $this->postJson('/api/spa/auth/email/verify', ['code' => '123456'])->assertUnauthorized();
    $this->postJson('/api/spa/auth/email/resend')->assertUnauthorized();
});

it('verifies the email and reflects it on the local user', function () {
    $user = actingVerificationUser();

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('verifyEmail')->once()->with('123456')->andReturn([
        'success' => true,
        'user' => verifiedApiUser(),
    ]);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/auth/email/verify', ['code' => '123456'])
        ->assertOk()
        ->assertJsonPath('user.email_verified', true)
        ->assertJsonPath('user.email_verification_required', false);

    expect(User::where('api_user_id', VERIFY_API_USER_ID)->value('email_verified_at'))->not->toBeNull();
});

it('surfaces an invalid code as a validation error', function () {
    $user = actingVerificationUser();

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('verifyEmail')->once()->andReturn([
        'success' => false,
        'errors' => ['code' => ['The verification code is incorrect.']],
    ]);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/auth/email/verify', ['code' => '000000'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');
});

it('resends a verification code', function () {
    $user = actingVerificationUser();

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('resendEmailVerification')->once()->andReturn([
        'success' => true,
        'message' => 'A new verification code has been sent.',
    ]);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/auth/email/resend')
        ->assertOk();
});

it('passes the cooldown through as a 429', function () {
    $user = actingVerificationUser();

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('resendEmailVerification')->once()->andReturn([
        'success' => false,
        'status' => 429,
        'retry_after' => 42,
        'message' => 'Please wait before requesting another code.',
    ]);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/auth/email/resend')
        ->assertStatus(429)
        ->assertJsonPath('retry_after', 42);
});
