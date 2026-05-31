<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Splash source
    |--------------------------------------------------------------------------
    |
    | The animation filename inside resources/splash. A single string is shown
    | in both light and dark mode; use a per-theme array for distinct assets.
    |
    */
    'source' => 'splash.json',

    /*
    |--------------------------------------------------------------------------
    | Background colour (per theme)
    |--------------------------------------------------------------------------
    |
    | Brand blue behind the cream Innerr wordmark. Match these to the native
    | launch screen background for a seamless cold start.
    |
    */
    'background' => [
        'light' => '#373D8A',
        'dark' => '#373D8A',
    ],

    // How the animation scales to fill the screen: contain | cover | center.
    'content_mode' => 'cover',

    // Hold the logo on its first frame until the app hides it (vs play on show).
    'autoplay' => false,

    // Play the animation out (branded dismiss) when hiding, instead of a fade.
    'play_to_end' => true,

    // Minimum time (ms) the splash stays up, to avoid a flash on fast boots.
    'min_visible_ms' => 700,

    // Fade-out duration (ms) applied after the out-animation, when hiding.
    'fade_out_ms' => 250,
];
