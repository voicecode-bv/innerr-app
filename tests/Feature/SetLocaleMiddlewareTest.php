<?php

use App\Http\Middleware\SetLocale;
use Illuminate\Http\Request;

beforeEach(function () {
    app()->setLocale(config('app.locale'));
});

it('honours an Accept-Language header for fr', function () {
    $request = Request::create('/');
    $request->headers->set('Accept-Language', 'fr');

    (new SetLocale)->handle($request, fn () => response()->noContent());

    expect(app()->getLocale())->toBe('fr');
});

it('honours an Accept-Language header for nl', function () {
    $request = Request::create('/');
    $request->headers->set('Accept-Language', 'nl');

    (new SetLocale)->handle($request, fn () => response()->noContent());

    expect(app()->getLocale())->toBe('nl');
});

it('falls back to the default locale for unsupported languages', function () {
    $request = Request::create('/');
    $request->headers->set('Accept-Language', 'de');

    (new SetLocale)->handle($request, fn () => response()->noContent());

    expect(app()->getLocale())->toBe(config('app.locale'));
});
