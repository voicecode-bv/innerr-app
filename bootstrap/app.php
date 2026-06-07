<?php

use App\Http\Middleware\AuthenticateApiToken;
use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            SetLocale::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // CSRF protection is unavailable to the BFF/API endpoints: they are hit
        // as an API from the NativePHP WebView (and across devices), where the
        // browser-managed token/Origin is not present. These endpoints are
        // instead protected by bearer/API-token auth and rate limiting.
        $middleware->preventRequestForgery(except: [
            'api/spa/*',
            'posts/cropped-media',
            'posts/upload-session',
            'posts/upload-session/*',
        ]);

        $middleware->alias([
            'auth.api' => AuthenticateApiToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
