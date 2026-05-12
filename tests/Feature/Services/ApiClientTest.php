<?php

use App\Services\ApiClient;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Http;

it('forwards the active locale via Accept-Language', function () {
    App::setLocale('nl');
    Http::fake();

    app(ApiClient::class)->sendPasswordResetLink('jane@example.com');

    Http::assertSent(fn ($request) => $request->hasHeader('Accept-Language', 'nl'));
});
