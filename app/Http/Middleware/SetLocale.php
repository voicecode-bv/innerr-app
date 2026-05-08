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

        // Accept-Language wint van user.locale: de SPA stuurt deze header op
        // élke call met de actueel-gekozen taal. user.locale wordt alleen op
        // bootstrap gesynct, dus die loopt achter zodra de gebruiker tijdens
        // een sessie van taal wisselt — wat de Edge bottom-nav labels stale
        // zou maken tot de volgende cold-start.
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
