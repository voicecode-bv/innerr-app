<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\ApiClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SocialAuthController extends Controller
{
    public function __construct(protected ApiClient $apiClient) {}

    public function callback(Request $request): RedirectResponse
    {
        if ($request->filled('error')) {
            return $this->redirectToCallback([
                'error' => $request->string('error')->toString(),
            ]);
        }

        $token = $request->string('token')->toString();

        if ($token === '') {
            return $this->redirectToCallback(['error' => 'missing_token']);
        }

        // Validate here so we fail clearly before the auth sheet closes.
        // The SPA receives the token via the deeplink and stores it in the
        // Keychain itself — the WKWebView and this auth session share no cookies.
        $this->apiClient->storeToken($token);
        $result = $this->apiClient->validateToken();
        $this->apiClient->clearToken();

        if (! ($result['valid'] ?? false)) {
            return $this->redirectToCallback(['error' => 'invalid_token']);
        }

        return $this->redirectToCallback(['token' => $token]);
    }

    /**
     * @param  array<string, string>  $params
     */
    protected function redirectToCallback(array $params): RedirectResponse
    {
        $scheme = config('nativephp.deeplink_scheme');

        if (! is_string($scheme) || $scheme === '') {
            // No scheme configured (e.g. web environment) → fall back to
            // an internal route so the browser flow keeps working.
            return isset($params['error'])
                ? redirect('/login?oauth_error='.urlencode($params['error']))
                : redirect('/?oauth=success');
        }

        return redirect($scheme.'://oauth-callback?'.http_build_query($params));
    }
}
