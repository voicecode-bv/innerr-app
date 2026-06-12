<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $supported = ['en', 'nl', 'fr'];

        // Accept-Language wins over user.locale: the SPA sends this header on
        // every call with the currently selected language. user.locale is only
        // synced on bootstrap, so it lags as soon as the user switches language
        // mid-session — which would leave the Edge bottom-nav labels stale
        // until the next cold start.
        $headerLocale = $request->hasHeader('Accept-Language')
            ? $request->getPreferredLanguage($supported)
            : null;

        if ($headerLocale && in_array($headerLocale, $supported, true)) {
            app()->setLocale($headerLocale);
        } elseif ($request->user()?->locale && in_array($request->user()->locale, $supported, true)) {
            app()->setLocale($request->user()->locale);
        } elseif (session('locale') && in_array(session('locale'), $supported, true)) {
            app()->setLocale(session('locale'));
        }

        return $next($request);
    }
}
