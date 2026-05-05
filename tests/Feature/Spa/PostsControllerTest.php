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
    @mkdir(dirname($this->tempPath), 0755, true);
    // 1x1 transparent JPEG
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

it('forwards multipart upload to external API and returns post data', function () {
    $user = User::factory()->create();

    $apiResponse = new Response(Http::response([
        'data' => ['id' => POST_ID, 'caption' => 'Hi'],
    ], 201)->wait());

    $pending = Mockery::mock(PendingRequest::class);
    $pending->shouldReceive('attach')->once()->andReturnSelf();
    $pending->shouldReceive('post')->once()->with('/posts', Mockery::any())->andReturn($apiResponse);

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
});
