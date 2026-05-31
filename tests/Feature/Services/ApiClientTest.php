<?php

use App\Services\ApiClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Http;

// Force the session-backed token store so the real ApiClient can persist a
// token in tests (the auto-detected SecureStorage driver is a no-op here).
beforeEach(function () {
    config(['api-client.token_driver' => 'session']);
    $this->app->forgetScopedInstances();
});

it('forwards the active locale via Accept-Language', function () {
    App::setLocale('nl');
    Http::fake();

    app(ApiClient::class)->sendPasswordResetLink('jane@example.com');

    Http::assertSent(fn ($request) => $request->hasHeader('Accept-Language', 'nl'));
});

it('marks the token valid and returns the user on a 2xx response', function () {
    Http::fake(['*/auth/me' => Http::response(['user' => ['id' => 'u1', 'name' => 'Jane']], 200)]);

    $client = app(ApiClient::class);
    $client->storeToken('valid-token');

    $result = $client->validateToken();

    expect($result['valid'])->toBeTrue()
        ->and($result['status'])->toBe('valid')
        ->and($result['user']['name'])->toBe('Jane')
        ->and($client->hasToken())->toBeTrue();
});

it('clears the token only on a definitive 401/403 rejection', function (int $status) {
    Http::fake(['*/auth/me' => Http::response(['message' => 'nope'], $status)]);

    $client = app(ApiClient::class);
    $client->storeToken('rejected-token');

    $result = $client->validateToken();

    expect($result['valid'])->toBeFalse()
        ->and($result['status'])->toBe('invalid')
        ->and($client->hasToken())->toBeFalse();
})->with([401, 403]);

it('keeps the token on a transient upstream failure', function (int $status) {
    Http::fake(['*/auth/me' => Http::response(['message' => 'oops'], $status)]);

    $client = app(ApiClient::class);
    $client->storeToken('still-valid-token');

    $result = $client->validateToken();

    expect($result['valid'])->toBeFalse()
        ->and($result['status'])->toBe('unreachable')
        ->and($client->hasToken())->toBeTrue();
})->with([429, 500, 502, 503, 504]);

it('keeps the token when the API is unreachable', function () {
    Http::fake(['*/auth/me' => fn () => throw new ConnectionException('timeout')]);

    $client = app(ApiClient::class);
    $client->storeToken('still-valid-token');

    $result = $client->validateToken();

    expect($result['status'])->toBe('unreachable')
        ->and($client->hasToken())->toBeTrue();
});
