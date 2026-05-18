<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tempDir = sys_get_temp_dir().'/innerr-tests-'.uniqid();
    mkdir($this->tempDir, 0777, true);
});

afterEach(function () {
    if (is_dir($this->tempDir)) {
        foreach (glob($this->tempDir.'/**/*') ?: [] as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }
        foreach (array_reverse(glob($this->tempDir.'/*', GLOB_ONLYDIR) ?: []) as $dir) {
            @rmdir($dir);
        }
        @rmdir($this->tempDir);
    }
});

it('serves a small image as a data URL', function () {
    $user = User::factory()->create();

    $path = $this->tempDir.'/image.jpg';
    file_put_contents($path, 'hello');

    $response = $this->actingAs($user)
        ->getJson('/native-media?path='.urlencode($path))
        ->assertOk()
        ->assertJsonStructure(['data_url']);

    expect($response->json('data_url'))->toStartWith('data:');
});

it('serves a video file as a data URL too', function () {
    $user = User::factory()->create();

    // Minimal MP4 ftyp box voor mime detection (mp42 brand).
    $path = $this->tempDir.'/clip.mp4';
    $bytes = "\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42mp41isomavc1";
    file_put_contents($path, $bytes.str_repeat("\x00", 200));

    $response = $this->actingAs($user)
        ->getJson('/native-media?path='.urlencode($path))
        ->assertOk();

    expect($response->json('data_url'))->toStartWith('data:video/mp4;base64,');
});

it('rejects an inline preview that exceeds the size cap', function () {
    $user = User::factory()->create();

    $path = $this->tempDir.'/big.bin';
    file_put_contents($path, str_repeat('A', 51 * 1024 * 1024));

    $this->actingAs($user)
        ->getJson('/native-media?path='.urlencode($path))
        ->assertStatus(413);
});

it('refuses native-media without auth', function () {
    $this->getJson('/native-media?path=/x')->assertStatus(401);
});

it('returns 404 for an unknown path', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/native-media?path='.urlencode('/does/not/exist.mp4'))
        ->assertStatus(404);
});
