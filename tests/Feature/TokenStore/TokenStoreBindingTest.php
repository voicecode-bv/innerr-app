<?php

use App\Services\TokenStore\SecureStorageTokenStore;
use App\Services\TokenStore\SessionTokenStore;
use App\Services\TokenStore\TokenStore;

it('picks the session store outside the NativePHP runtime under auto', function () {
    config(['api-client.token_driver' => 'auto']);

    $this->app->forgetScopedInstances();

    // nativephp/mobile >= 3.3.6 registers a userland nativephp_call() fallback
    // (Jump hybrid mode) on dev machines; only the on-device C extension is
    // internal, so auto must still resolve to the session store here.
    if (function_exists('nativephp_call')) {
        expect((new ReflectionFunction('nativephp_call'))->isInternal())->toBeFalse();
    }

    expect(app(TokenStore::class))->toBeInstanceOf(SessionTokenStore::class);
});

it('honors an explicit session driver override', function () {
    config(['api-client.token_driver' => 'session']);

    $this->app->forgetScopedInstances();

    expect(app(TokenStore::class))->toBeInstanceOf(SessionTokenStore::class);
});

it('honors an explicit secure_storage driver override', function () {
    config(['api-client.token_driver' => 'secure_storage']);

    $this->app->forgetScopedInstances();

    expect(app(TokenStore::class))->toBeInstanceOf(SecureStorageTokenStore::class);
});
