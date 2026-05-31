<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns active tab for the home path', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/']);

    $response->assertOk()->assertJsonPath('active', 'home');
});

it('keeps the home tab active on the masonry grid feed', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/feed/grid']);

    $response->assertOk()->assertJsonPath('active', 'home');
});

it('marks the circles tab active on the circles index', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/circles']);

    $response->assertOk()->assertJsonPath('active', 'circles');
});

it('leaves the circles tab inactive on a nested circle page', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/circles/12']);

    $response->assertOk()->assertJsonPath('active', '');
});

it('leaves every tab inactive for settings paths', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/settings/persons']);

    $response->assertOk()->assertJsonPath('active', '');
});

it('returns active tab for a profile path', function () {
    $user = User::factory()->create(['username' => 'jane']);

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/profiles/jane']);

    $response->assertOk()->assertJsonPath('active', 'profile');
});

it('treats a profile map path as the map tab', function () {
    $user = User::factory()->create(['username' => 'jane']);

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/profiles/jane/map']);

    $response->assertOk()->assertJsonPath('active', 'map');
});

it('returns active tab for the global map path', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/map']);

    $response->assertOk()->assertJsonPath('active', 'map');
});

it('returns active tab for a circle map path', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/circles/12/map']);

    $response->assertOk()->assertJsonPath('active', 'map');
});

it('leaves every tab inactive when visiting notifications', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/notifications']);

    $response->assertOk()->assertJsonPath('active', '');
});

it('clears the bottom nav for onboarding paths', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/onboarding/intro']);

    $response->assertOk()->assertJsonPath('cleared', true);
});

it('clears the bottom nav on the create-post wizard', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', ['path' => '/posts/create']);

    $response->assertOk()->assertJsonPath('cleared', true);
});

it('rejects requests without authentication', function () {
    $this->postJson('/api/spa/edge/active-tab', ['path' => '/'])
        ->assertStatus(401);
});

it('validates the path parameter', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/edge/active-tab', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('path');
});
