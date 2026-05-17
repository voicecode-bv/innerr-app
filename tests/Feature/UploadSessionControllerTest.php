<?php

use App\Http\Controllers\PostActionController;
use App\Http\Controllers\UploadSessionController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

afterEach(function () {
    File::deleteDirectory(UploadSessionController::sessionsDirectory());
    File::deleteDirectory(PostActionController::croppedMediaDirectory());
});

it('rejects upload-session calls without auth', function () {
    $this->postJson('/posts/upload-session')->assertStatus(401);
});

it('initialises a session tied to the user', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/posts/upload-session')
        ->assertOk()
        ->assertJsonStructure(['upload_id', 'chunk_size', 'max_chunks']);

    $uploadId = $response->json('upload_id');
    $directory = UploadSessionController::sessionDirectory($uploadId);

    expect(is_dir($directory))->toBeTrue();
    $meta = json_decode((string) file_get_contents($directory.'/meta.json'), true);
    expect($meta['user_id'])->toBe($user->id);
});

it('rejects chunk upload for non-existent session', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/posts/upload-session/'.Str::uuid().'/chunk', [
            'sequence' => 0,
            'data' => base64_encode('hello'),
        ])
        ->assertStatus(404);
});

it('rejects chunks from a different user', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();

    $uploadId = $this->actingAs($owner)
        ->postJson('/posts/upload-session')
        ->json('upload_id');

    $this->actingAs($intruder)
        ->postJson("/posts/upload-session/{$uploadId}/chunk", [
            'sequence' => 0,
            'data' => base64_encode('x'),
        ])
        ->assertStatus(404);
});

it('assembles chunks in correct order on finalize and writes EXIF sidecar', function () {
    $user = User::factory()->create();

    $uploadId = $this->actingAs($user)
        ->postJson('/posts/upload-session')
        ->json('upload_id');

    // Upload sequence 1 first to verify out-of-order is fine.
    $this->actingAs($user)
        ->postJson("/posts/upload-session/{$uploadId}/chunk", [
            'sequence' => 1,
            'data' => base64_encode('-world'),
        ])
        ->assertOk();

    $finalResponse = $this->actingAs($user)
        ->postJson("/posts/upload-session/{$uploadId}/chunk", [
            'sequence' => 0,
            'data' => base64_encode('hello'),
            'final' => true,
            'taken_at' => '2025-04-01T09:00:00Z',
            'latitude' => 50.1,
            'longitude' => 8.7,
        ])
        ->assertOk();

    $path = $finalResponse->json('path');

    expect(file_exists($path))->toBeTrue()
        ->and(file_get_contents($path))->toBe('hello-world');

    $exif = json_decode((string) file_get_contents($path.'.exif.json'), true);
    expect($exif['taken_at'])->toBe('2025-04-01T09:00:00Z')
        ->and($exif['latitude'])->toBe(50.1)
        ->and($exif['longitude'])->toBe(8.7);

    expect(is_dir(UploadSessionController::sessionDirectory($uploadId)))->toBeFalse();
});

it('aborts a session and cleans up chunks', function () {
    $user = User::factory()->create();

    $uploadId = $this->actingAs($user)
        ->postJson('/posts/upload-session')
        ->json('upload_id');

    $this->actingAs($user)
        ->postJson("/posts/upload-session/{$uploadId}/chunk", [
            'sequence' => 0,
            'data' => base64_encode('partial'),
        ])
        ->assertOk();

    $this->actingAs($user)
        ->deleteJson("/posts/upload-session/{$uploadId}")
        ->assertOk();

    expect(is_dir(UploadSessionController::sessionDirectory($uploadId)))->toBeFalse();
});

it('rejects invalid base64 chunk data', function () {
    $user = User::factory()->create();

    $uploadId = $this->actingAs($user)
        ->postJson('/posts/upload-session')
        ->json('upload_id');

    $this->actingAs($user)
        ->postJson("/posts/upload-session/{$uploadId}/chunk", [
            'sequence' => 0,
            'data' => '!!!not-base64@@@',
        ])
        ->assertStatus(422);
});

it('GC command deletes stale sessions but keeps fresh ones', function () {
    $user = User::factory()->create();

    $freshId = $this->actingAs($user)->postJson('/posts/upload-session')->json('upload_id');
    $staleId = $this->actingAs($user)->postJson('/posts/upload-session')->json('upload_id');

    // Backdate the stale session by mutating mtime on the meta file.
    $staleMeta = UploadSessionController::sessionDirectory($staleId).'/meta.json';
    touch($staleMeta, now()->subDays(2)->getTimestamp());

    $this->artisan('posts:gc-upload-sessions')->assertSuccessful();

    expect(is_dir(UploadSessionController::sessionDirectory($freshId)))->toBeTrue()
        ->and(is_dir(UploadSessionController::sessionDirectory($staleId)))->toBeFalse();
});
