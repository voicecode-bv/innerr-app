<?php

use App\Models\User;
use App\Services\ApiClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tempPath = storage_path('app/private/'.uniqid('test_post_', true).'.jpg');
    $this->tempPathB = storage_path('app/private/'.uniqid('test_post_', true).'.jpg');
    @mkdir(dirname($this->tempPath), 0755, true);
    // 1x1 transparent JPEG
    $jpeg = base64_decode(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ'.
        'EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB'.
        'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABA'.
        'QAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP'.
        '/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgB//Z'
    );
    file_put_contents($this->tempPath, $jpeg);
    file_put_contents($this->tempPathB, $jpeg);
});

afterEach(function () {
    @unlink($this->tempPath);
    @unlink($this->tempPathB);
    @unlink($this->tempPath.'.exif.json');
    @unlink($this->tempPathB.'.exif.json');
});

const POST_ID = '550e8400-e29b-41d4-a716-446655440099';
const CIRCLE_ID_A = '550e8400-e29b-41d4-a716-446655440001';
const CIRCLE_ID_B = '550e8400-e29b-41d4-a716-446655440002';

it('rejects post creation without auth', function () {
    $this->postJson('/api/spa/posts', [
        'media_path' => '/tmp/x.jpg',
        'circle_ids' => [CIRCLE_ID_A],
    ])->assertStatus(401);
});

it('returns 422 when media_path does not exist', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_path' => '/non/existent/path.jpg',
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('media_path');
});

it('returns 422 when media_paths contains a missing file', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_paths' => [$this->tempPath, '/non/existent/path.jpg'],
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('media_paths.1');
});

it('rejects when neither media_path nor media_paths is provided', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['media_path', 'media_paths']);
});

it('rejects when media_paths exceeds the maximum', function () {
    $user = User::factory()->create();

    $paths = array_fill(0, 11, $this->tempPath);

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_paths' => $paths,
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('media_paths');
});

it('forwards single multipart upload to external API and returns post data', function () {
    $user = User::factory()->create();

    $apiResponse = new Response(Http::response([
        'data' => ['id' => POST_ID, 'caption' => 'Hi'],
    ], 201)->wait());

    $sentData = null;
    $attachCalls = [];

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->andReturnUsing(function ($name, $body, $filename, $headers) use (&$attachCalls, $pending) {
        $attachCalls[] = $name;

        return $pending;
    });
    $pending->shouldReceive('post')->once()->with('/posts', Mockery::on(function ($data) use (&$sentData) {
        $sentData = $data;

        return true;
    }))->andReturn($apiResponse);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $client->shouldReceive('proxyMediaUrls')->andReturn(['id' => POST_ID, 'caption' => 'Hi']);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_path' => $this->tempPath,
            'caption' => 'Hi',
            'circle_ids' => [CIRCLE_ID_A, CIRCLE_ID_B],
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.id', POST_ID);

    expect($attachCalls)->toBe(['media']);
    expect($sentData)->not->toHaveKey('media_metadata');
});

it('forwards multi-photo upload as media[] with media_metadata json', function () {
    $user = User::factory()->create();

    $apiResponse = new Response(Http::response([
        'data' => ['id' => POST_ID, 'caption' => 'Hi'],
    ], 201)->wait());

    $sentData = null;
    $attachCalls = [];

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->andReturnUsing(function ($name) use (&$attachCalls, $pending) {
        $attachCalls[] = $name;

        return $pending;
    });
    $pending->shouldReceive('post')->once()->with('/posts', Mockery::on(function ($data) use (&$sentData) {
        $sentData = $data;

        return true;
    }))->andReturn($apiResponse);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $client->shouldReceive('proxyMediaUrls')->andReturn(['id' => POST_ID]);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_paths' => [$this->tempPath, $this->tempPathB],
            'media_metadata' => [
                ['taken_at' => '2025-01-01T10:00:00Z', 'latitude' => 52.37, 'longitude' => 4.89],
                ['taken_at' => '2025-01-02T11:00:00Z', 'latitude' => null, 'longitude' => null],
            ],
            'caption' => 'Hi',
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(201);

    expect($attachCalls)->toBe(['media[]', 'media[]']);

    $metadata = json_decode($sentData['media_metadata'], true);
    expect($metadata)->toHaveCount(2)
        ->and($metadata[0]['latitude'])->toBe(52.37)
        ->and($metadata[1]['taken_at'])->toBe('2025-01-02T11:00:00Z');
});

it('merges sidecar EXIF and falls back to top-level fields on single upload', function () {
    $user = User::factory()->create();

    file_put_contents($this->tempPath.'.exif.json', json_encode([
        'taken_at' => '2025-03-01T12:00:00Z',
        'latitude' => 51.5,
        'longitude' => -0.12,
    ]));

    $sentData = null;
    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->andReturnSelf();
    $pending->shouldReceive('post')->once()->with('/posts', Mockery::on(function ($data) use (&$sentData) {
        $sentData = $data;

        return true;
    }))->andReturn(new Response(Http::response(['data' => ['id' => POST_ID]], 201)->wait()));

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $client->shouldReceive('proxyMediaUrls')->andReturn(['id' => POST_ID]);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_path' => $this->tempPath,
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(201);

    expect($sentData['taken_at'])->toBe('2025-03-01T12:00:00Z')
        ->and($sentData['latitude'])->toBe(51.5)
        ->and($sentData['longitude'])->toBe(-0.12);
});

it('forwards map-picker coordinates and they win over EXIF on single upload', function () {
    $user = User::factory()->create();

    // EXIF in the sidecar would otherwise set the position...
    file_put_contents($this->tempPath.'.exif.json', json_encode([
        'taken_at' => '2025-03-01T12:00:00Z',
        'latitude' => 51.5,
        'longitude' => -0.12,
    ]));

    $sentData = null;
    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->andReturnSelf();
    $pending->shouldReceive('post')->once()->with('/posts', Mockery::on(function ($data) use (&$sentData) {
        $sentData = $data;

        return true;
    }))->andReturn(new Response(Http::response(['data' => ['id' => POST_ID]], 201)->wait()));

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $client->shouldReceive('proxyMediaUrls')->andReturn(['id' => POST_ID]);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_path' => $this->tempPath,
            'location' => 'Madrid',
            'latitude' => 40.4168,
            'longitude' => -3.7038,
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(201);

    // ...but the explicit picker coordinates win as the post position.
    expect($sentData['location'])->toBe('Madrid')
        ->and($sentData['latitude'])->toBe(40.4168)
        ->and($sentData['longitude'])->toBe(-3.7038);
});

it('forwards map-picker coordinates alongside per-item metadata on multi upload', function () {
    $user = User::factory()->create();

    $sentData = null;
    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->andReturnSelf();
    $pending->shouldReceive('post')->once()->with('/posts', Mockery::on(function ($data) use (&$sentData) {
        $sentData = $data;

        return true;
    }))->andReturn(new Response(Http::response(['data' => ['id' => POST_ID]], 201)->wait()));

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $client->shouldReceive('proxyMediaUrls')->andReturn(['id' => POST_ID]);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_paths' => [$this->tempPath, $this->tempPathB],
            'latitude' => 40.4168,
            'longitude' => -3.7038,
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(201);

    expect($sentData['latitude'])->toBe(40.4168)
        ->and($sentData['longitude'])->toBe(-3.7038)
        ->and($sentData)->toHaveKey('media_metadata');
});

it('rejects map-picker coordinates that are out of range', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_path' => $this->tempPath,
            'latitude' => 200,
            'longitude' => 4.89,
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('latitude');
});

it('flattens external media.{i} errors to media_paths.{i}', function () {
    $user = User::factory()->create();

    $errorResponse = new Response(Http::response([
        'errors' => ['media.1' => ['Unsupported format']],
    ], 422)->wait());

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->andReturnSelf();
    $pending->shouldReceive('post')->once()->andReturn($errorResponse);

    $client = Mockery::mock(ApiClient::class);
    $client->shouldReceive('authenticated')->andReturn($pending);
    $this->app->instance(ApiClient::class, $client);

    $this->actingAs($user)
        ->postJson('/api/spa/posts', [
            'media_paths' => [$this->tempPath, $this->tempPathB],
            'circle_ids' => [CIRCLE_ID_A],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('media_paths.1');
});
