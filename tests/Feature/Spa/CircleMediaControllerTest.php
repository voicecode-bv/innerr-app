<?php

use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tempPath = storage_path('app/private/'.uniqid('test_circle_', true).'.jpg');
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

it('rejects circle photo upload without auth', function () {
    $this->postJson('/api/spa/circles/550e8400-e29b-41d4-a716-446655440001/photo', [
        'photo_path' => '/tmp/x.jpg',
    ])->assertStatus(401);
});

it('returns 422 when circle photo_path does not exist', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/circles/550e8400-e29b-41d4-a716-446655440001/photo', [
            'photo_path' => '/non/existent/photo.jpg',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('photo_path');
});

it('forwards multipart upload and invalidates circles cache', function () {
    $user = User::factory()->create();
    Cache::put(ApiClient::circlesCacheKey(), [['id' => '550e8400-e29b-41d4-a716-446655440001']], 300);

    $apiResponse = new Response(Http::response(['ok' => true], 200)->wait());

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->once()->andReturnSelf();
    $pending->shouldReceive('post')->once()->with('/circles/550e8400-e29b-41d4-a716-446655440009/photo')->andReturn($apiResponse);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/circles/550e8400-e29b-41d4-a716-446655440009/photo', [
            'photo_path' => $this->tempPath,
        ])
        ->assertOk()
        ->assertJson(['ok' => true]);

    expect(Cache::get(ApiClient::circlesCacheKey()))->toBeNull();
});

it('returns 422 when external API rejects circle photo', function () {
    $user = User::factory()->create();

    $apiResponse = new Response(Http::response([
        'errors' => ['photo' => ['Unsupported format']],
    ], 422)->wait());

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->andReturnSelf();
    $pending->shouldReceive('post')->andReturn($apiResponse);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/circles/550e8400-e29b-41d4-a716-446655440009/photo', [
            'photo_path' => $this->tempPath,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('photo_path');
});

it('uploads circle photo from base64 payload and invalidates cache', function () {
    $user = User::factory()->create();
    Cache::put(ApiClient::circlesCacheKey(), [['id' => '550e8400-e29b-41d4-a716-446655440001']], 300);

    $apiResponse = new Response(Http::response([
        'data' => ['photo' => 'https://api.example.com/circles/99.jpg'],
    ], 200)->wait());

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')
        ->once()
        ->withArgs(function ($field, $contents, $filename, $headers) {
            return $field === 'photo'
                && is_string($contents)
                && $contents !== ''
                && $filename === 'circle-photo.jpg'
                && ($headers['Content-Type'] ?? null) === 'image/jpeg';
        })
        ->andReturnSelf();
    $pending->shouldReceive('post')->once()->with('/circles/550e8400-e29b-41d4-a716-446655440009/photo')->andReturn($apiResponse);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $this->app->instance(ApiClient::class, $client);

    $base64 = base64_encode(file_get_contents($this->tempPath));

    $this->actingAs($user)
        ->postJson('/api/spa/circles/550e8400-e29b-41d4-a716-446655440009/photo', [
            'photo_data' => $base64,
        ])
        ->assertOk()
        ->assertJsonPath('photo', 'https://api.example.com/circles/99.jpg');

    expect(Cache::get(ApiClient::circlesCacheKey()))->toBeNull();
});

it('returns 422 when neither photo_path nor photo_data is provided', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/circles/550e8400-e29b-41d4-a716-446655440001/photo', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['photo_path', 'photo_data']);
});

it('returns 422 when photo_data is not valid base64', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/circles/550e8400-e29b-41d4-a716-446655440001/photo', [
            'photo_data' => '###not-base64###',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('photo_data');
});
