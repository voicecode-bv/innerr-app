<!DOCTYPE html>
<html lang="{{ str_replace('_','-', app()->getLocale()) }}"@class(['dark'=> ($appearance ??'system') =='dark'])>
 <head>
 <meta charset="utf-8">
 <meta name="viewport"content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"/>
 <meta name="theme-color"content="#ffffff">
 <title>{{ config('app.name','Innerr') }} — SPA spike</title>
 @vite(['resources/css/app.css','resources/js/spa/main.ts'])
 </head>
 <body class="relative bg-warmwhite text-sand-900 dark:bg-sand-900 dark:text-sand-100 font-sans text-base antialiased">
 <div id="spa-app"></div>
 </body>
</html>
