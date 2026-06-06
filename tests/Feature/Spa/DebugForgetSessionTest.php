<?php

use App\Models\User;
use App\Services\TokenStore\TokenStore;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('forgets the session on the debug route without clearing the token', function () {
    // The route must only drop the Laravel session, never the durable token, so
    // it can reproduce "session gone, token still valid" for reconnect testing.
    $tokenStore = Mockery::mock(TokenStore::class)->shouldIgnoreMissing();
    $tokenStore->shouldNotReceive('delete');
    $this->app->instance(TokenStore::class, $tokenStore);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/debug/forget-session')
        ->assertOk()
        ->assertJson(['ok' => true]);

    $this->assertGuest();
});
