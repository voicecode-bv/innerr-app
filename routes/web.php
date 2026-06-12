<?php

use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\MapController;
use App\Http\Controllers\MediaProxyController;
use App\Http\Controllers\PostActionController;
use App\Http\Controllers\Spa\AuthController as SpaAuthController;
use App\Http\Controllers\Spa\BootstrapController as SpaBootstrapController;
use App\Http\Controllers\Spa\CircleMediaController as SpaCircleMediaController;
use App\Http\Controllers\Spa\EmailVerificationController as SpaEmailVerificationController;
use App\Http\Controllers\Spa\PersonsController as SpaPersonsController;
use App\Http\Controllers\Spa\PostsController as SpaPostsController;
use App\Http\Controllers\Spa\SettingsController as SpaSettingsController;
use App\Http\Controllers\UploadSessionController;
use App\Services\ApiClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

// SPA BFF — only what technically cannot be done client-side: bootstrap mirror,
// auth-token holder, and file-upload paths for which NativePhp Camera yields a
// file:// path that is only readable server-side.
Route::prefix('api/spa')->group(function () {
    Route::get('/bootstrap', SpaBootstrapController::class);
    Route::post('/auth/login', [SpaAuthController::class, 'login']);
    Route::post('/auth/register', [SpaAuthController::class, 'register']);
    Route::post('/auth/forgot-password', [SpaAuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [SpaAuthController::class, 'resetPassword']);

    // Debug/test: forgets only the Laravel session (logout + invalidate) but
    // leaves the token in secure storage. Simulates "session gone, token still
    // valid" so the reconnect flow can be tested on a real device without
    // reinstalling the app. Touches only the caller's own session.
    // Reachable via the hidden debug page.
    Route::post('/debug/forget-session', function (Request $request) {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    });

    // Debug/test: dump of the caller's own Laravel session + held API token. The
    // hidden debug page forwards this via the support endpoint so token/session
    // issues can be inspected from a real device. Reads only the caller's own
    // session, just like forget-session above.
    Route::get('/debug/session-dump', function (Request $request, ApiClient $apiClient) {
        $user = $request->user();

        return response()->json([
            'session_id' => $request->session()->getId(),
            'session' => $request->session()->all(),
            'server_token' => $apiClient->hasToken() ? $apiClient->getToken() : null,
            'auth_status' => $user ? 'authenticated' : 'guest',
            'user' => $user ? [
                'id' => $user->api_user_id,
                'email' => $user->email,
                'username' => $user->username,
            ] : null,
        ]);
    });

    Route::middleware('auth.api')->group(function () {
        Route::post('/auth/logout', [SpaAuthController::class, 'logout']);
        Route::post('/auth/email/verify', [SpaEmailVerificationController::class, 'verify']);
        Route::post('/auth/email/resend', [SpaEmailVerificationController::class, 'resend']);

        Route::post('/settings/profile/avatar', [SpaSettingsController::class, 'updateAvatar']);
        Route::post('/settings/persons/{person}/photo', [SpaPersonsController::class, 'updatePhoto'])->whereUuid('person');
        Route::post('/circles/{circle}/photo', [SpaCircleMediaController::class, 'updatePhoto'])->whereUuid('circle');
        Route::post('/posts', [SpaPostsController::class, 'store']);
    });
});

// OAuth callback — external API redirects back to this BFF.
Route::get('/oauth/callback', [SocialAuthController::class, 'callback'])->name('oauth.callback');

// Public proxy: media cache (signed image URLs from the external API go through
// this proxy so tokens don't leak into the client).
Route::get('/media-proxy', MediaProxyController::class)->name('media-proxy');

// Session-cookie protected proxy paths. Reason for the BFF: NativePhp file://
// paths or the fetch side where PhotoMap adds no bearer headers.
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

// SPA shell — catches all remaining routes (incl. /, /login, /spa-test/*, etc.).
Route::get('/{any?}', fn () => view('spa'))
    ->where('any', '^(?!api/|oauth/|media-proxy|native-media|posts/cropped-media|posts/upload-session|photos/map|profiles/[^/]+/photos/map|circles/[^/]+/photos/map).*$')
    ->name('spa.shell');
