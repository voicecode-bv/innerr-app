<?php

use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tempPath = storage_path('app/private/'.uniqid('test_person_', true).'.jpg');
    @mkdir(dirname($this->tempPath), 0755, true);
    file_put_contents($this->tempPath, base64_decode(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ'.
        'EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB'.
        'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABA'.
        'QAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP'.
        '/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgB//Z'
    ));
});

afterEach(function () {
    @unlink($this->tempPath);
});

it('rejects person photo upload without auth', function () {
    $this->postJson('/api/spa/settings/persons/550e8400-e29b-41d4-a716-446655440001/photo', [
        'photo_path' => '/tmp/x.jpg',
    ])->assertStatus(401);
});

it('returns 422 when photo_path does not exist on disk', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/settings/persons/550e8400-e29b-41d4-a716-446655440001/photo', [
            'photo_path' => '/non/existent/photo.jpg',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('photo_path');
});

it('forwards multipart upload to external API for person avatar', function () {
    $user = User::factory()->create();

    $apiResponse = new Response(Http::response(['ok' => true], 200)->wait());

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->once()->andReturnSelf();
    $pending->shouldReceive('post')->once()->with('/persons/550e8400-e29b-41d4-a716-446655440007/avatar')->andReturn($apiResponse);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/settings/persons/550e8400-e29b-41d4-a716-446655440007/photo', [
            'photo_path' => $this->tempPath,
        ])
        ->assertOk()
        ->assertJson(['ok' => true]);
});

it('returns 422 when external API responds with errors on person photo upload', function () {
    $user = User::factory()->create();

    $apiResponse = new Response(Http::response([
        'errors' => ['avatar' => ['File is too large']],
    ], 422)->wait());

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->andReturnSelf();
    $pending->shouldReceive('post')->andReturn($apiResponse);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/settings/persons/550e8400-e29b-41d4-a716-446655440007/photo', [
            'photo_path' => $this->tempPath,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('photo');
});
