<?php

return [

    'base_url' => env('API_BASE_URL', 'https://api.innerr.app/api'),

    'timeout' => (int) env('API_TIMEOUT', 15),

    'token_key' => 'api_token',

    /*
    |--------------------------------------------------------------------------
    | Token Store Driver
    |--------------------------------------------------------------------------
    |
    | Determines where the API token is kept.
    |
    |   "auto"           — mobile requests (detected via the NativePHP header)
    |                      use secure storage; browser requests use the session.
    |   "secure_storage" — force the NativePHP SecureStorage driver.
    |   "session"        — force the Laravel session driver.
    */

    'token_driver' => env('API_TOKEN_DRIVER', 'auto'),

];
