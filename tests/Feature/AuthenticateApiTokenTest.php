<?php

use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 401 when the token is definitively rejected', function () {
    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('hasToken')->andReturn(true);
    $client->shouldReceive('validateToken')->andReturn(['valid' => false, 'status' => 'invalid']);
    $this->app->instance(ApiClient::class, $client);

    $this->withToken('rejected')
        ->postJson('/api/spa/auth/logout')
        ->assertStatus(401);
});

it('returns 503 on a transient upstream failure so the client keeps its token', function () {
    $client = Mockery::mock(ApiClient::class)->shouldIgnoreMissing();
    $client->shouldReceive('hasToken')->andReturn(true);
    $client->shouldReceive('validateToken')->andReturn(['valid' => false, 'status' => 'unreachable']);
    $this->app->instance(ApiClient::class, $client);

    $this->withToken('still-valid')
        ->postJson('/api/spa/auth/logout')
        ->assertStatus(503);
});
