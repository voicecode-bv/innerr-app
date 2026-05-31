<!DOCTYPE html>
<html lang="{{ str_replace('_','-', app()->getLocale()) }}">
 <head>
 <meta charset="utf-8">
 <meta name="viewport"content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"/>
 <meta name="theme-color"content="#fcfaf3">
 <title>{{ config('app.name','Innerr') }} — SPA spike</title>
 {{-- Sync dark class + theme-color before first paint to avoid FOUC.
      Mirrors stores/appearance.ts (STORAGE_KEY = 'spa.appearance'). --}}
 <script>(function(){try{var m=localStorage.getItem('spa.appearance');var s=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var d=m==='dark'||((!m||m==='system')&&s);if(d){document.documentElement.classList.add('dark');var t=document.querySelector('meta[name="theme-color"]');if(t){t.setAttribute('content','#14172b');}}}catch(e){}})();</script>
 @animatedSplashConfig
 @vite(['resources/css/app.css','resources/js/spa/main.ts'])
 </head>
 <body class="relative bg-sand text-night font-sans text-base antialiased">
 <div id="spa-app"></div>
 <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
 <noscript><img src="https://queue.simpleanalyticscdn.com/noscript.gif" alt="" referrerpolicy="no-referrer-when-downgrade"/></noscript>
 </body>
</html>
