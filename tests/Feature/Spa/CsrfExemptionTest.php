<?php

use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Request;

// CSRF is unavailable to the NativePHP WebView (no browser-managed token/Origin),
// so the BFF/API endpoints are exempted in bootstrap/app.php. The framework also
// bypasses CSRF entirely while running tests, so asserting "no 419" over HTTP
// would pass regardless of config; instead we assert the exemption itself.

/**
 * Resolve the configured middleware and report whether the given path is exempt.
 */
function csrfExempts(string $path): bool
{
    $middleware = app(PreventRequestForgery::class);

    $method = new ReflectionMethod($middleware, 'inExceptArray');

    return $method->invoke($middleware, Request::create($path, 'POST'));
}

it('exempts the SPA auth endpoints from CSRF, fixing the login token mismatch', function () {
    expect(csrfExempts('/api/spa/auth/login'))->toBeTrue()
        ->and(csrfExempts('/api/spa/auth/register'))->toBeTrue()
        ->and(csrfExempts('/api/spa/auth/forgot-password'))->toBeTrue()
        ->and(csrfExempts('/api/spa/auth/reset-password'))->toBeTrue();
});

it('exempts the upload BFF endpoints from CSRF', function () {
    expect(csrfExempts('/posts/cropped-media'))->toBeTrue()
        ->and(csrfExempts('/posts/upload-session'))->toBeTrue()
        ->and(csrfExempts('/posts/upload-session/01HXYZ/chunk'))->toBeTrue();
});

it('keeps CSRF protection for non-exempt paths', function () {
    expect(csrfExempts('/some-web-form'))->toBeFalse();
});
