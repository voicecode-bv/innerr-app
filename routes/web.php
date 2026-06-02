<?php

use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\MediaProxyController;
use App\Http\Controllers\PostActionController;
use App\Http\Controllers\Spa\AuthController as SpaAuthController;
use App\Http\Controllers\Spa\BootstrapController as SpaBootstrapController;
use App\Http\Controllers\Spa\CircleMediaController as SpaCircleMediaController;
use App\Http\Controllers\Spa\EdgeController as SpaEdgeController;
use App\Http\Controllers\Spa\EmailVerificationController as SpaEmailVerificationController;
use App\Http\Controllers\Spa\PersonsController as SpaPersonsController;
use App\Http\Controllers\Spa\PostsController as SpaPostsController;
use App\Http\Controllers\Spa\SettingsController as SpaSettingsController;
use App\Http\Controllers\UploadSessionController;
use Illuminate\Support\Facades\Route;

// SPA BFF — alleen wat technisch niet client-side kan: bootstrap-mirror,
// auth-token-houder, native bridge (Edge), en file-upload paden waarvoor
// NativePhp Camera een file:// pad oplevert dat alleen serverside leesbaar is.
Route::prefix('api/spa')->group(function () {
    Route::get('/bootstrap', SpaBootstrapController::class);
    Route::post('/auth/login', [SpaAuthController::class, 'login']);
    Route::post('/auth/register', [SpaAuthController::class, 'register']);
    Route::post('/auth/forgot-password', [SpaAuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [SpaAuthController::class, 'resetPassword']);

    Route::middleware('auth.api')->group(function () {
        Route::post('/auth/logout', [SpaAuthController::class, 'logout']);
        Route::post('/auth/email/verify', [SpaEmailVerificationController::class, 'verify']);
        Route::post('/auth/email/resend', [SpaEmailVerificationController::class, 'resend']);
        Route::post('/edge/active-tab', [SpaEdgeController::class, 'setActiveTab']);

        Route::post('/settings/profile/avatar', [SpaSettingsController::class, 'updateAvatar']);
        Route::post('/settings/persons/{person}/photo', [SpaPersonsController::class, 'updatePhoto'])->whereUuid('person');
        Route::post('/circles/{circle}/photo', [SpaCircleMediaController::class, 'updatePhoto'])->whereUuid('circle');
        Route::post('/posts', [SpaPostsController::class, 'store']);
    });
});

// OAuth callback — externe API redirect terug naar deze BFF.
Route::get('/oauth/callback', [SocialAuthController::class, 'callback'])->name('oauth.callback');

// Public proxy: media-cache (signed image-URLs vanuit externe API gaan via deze
// proxy zodat tokens niet in de client lekken).
Route::get('/media-proxy', MediaProxyController::class)->name('media-proxy');

// Session-cookie protected proxy paden. Reden voor BFF: NativePhp file://
// paden of fetch-kant waar PhotoMap geen bearer-headers toevoegt.
Route::middleware('auth.api')->group(function () {
    Route::get('/native-media', [PostActionController::class, 'serveMedia'])->name('native-media');
    Route::post('/posts/cropped-media', [PostActionController::class, 'storeCroppedMedia'])->name('posts.cropped-media');

    Route::post('/posts/upload-session', [UploadSessionController::class, 'init'])->name('posts.upload-session.init');
    Route::post('/posts/upload-session/{upload}/chunk', [UploadSessionController::class, 'chunk'])->name('posts.upload-session.chunk');
    Route::delete('/posts/upload-session/{upload}', [UploadSessionController::class, 'abort'])->name('posts.upload-session.abort');

    Route::get('/photos/map', [MapController::class, 'photos'])->name('photos.map');
    Route::get('/profiles/{username}/photos/map', [MapController::class, 'profilePhotos'])->name('profiles.photos.map');
    Route::get('/circles/{circle}/photos/map', [MapController::class, 'circlePhotos'])->name('circles.photos.map')->whereUuid('circle');
});

// SPA shell — vangt alle overige routes (incl. /, /login, /spa-test/*, etc.).
Route::get('/{any?}', fn () => view('spa'))
    ->where('any', '^(?!api/|oauth/|media-proxy|native-media|posts/cropped-media|posts/upload-session|photos/map|profiles/[^/]+/photos/map|circles/[^/]+/photos/map).*$')
    ->name('spa.shell');
