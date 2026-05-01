<?php

/*
 * Configuration for NativePHP In-App Purchases.
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Default Product IDs
    |--------------------------------------------------------------------------
    |
    | Optional default product IDs fetched when products() is called without
    | explicit IDs (i.e. InApp::products()).
    |
    */
    'product_ids' => [
        'pro_apple_yearly',
        'pro_apple_monthly',
        'plus_apple_yearly',
        'plus_apple_monthly',
    ],

    /*
    |--------------------------------------------------------------------------
    | Server-Side Receipt / Purchase Validation
    |--------------------------------------------------------------------------
    |
    | When enabled, every successful purchase/restore/entitlement call will be
    | verified against the platform's server API and a 'server.validation'
    | payload will be attached to the response — additive only, never breaking.
    |
    | If validation is unavailable (missing config, network error, etc.) the
    | native purchase result is preserved and validation is marked 'unverified'.
    |
    */
    'server_validation' => [

        'enabled' => env('INAPP_SERVER_VALIDATION_ENABLED', false),

        /*
         * Which platforms should be validated server-side.
         * Remove a platform to skip validation for it while keeping the other.
         */
        'platforms' => ['ios', 'android'],

        /*
         * How long (seconds) to cache a validation result for a given
         * transaction. Prevents redundant API calls on repeated entitlement
         * checks. Set to 0 to disable caching.
         */
        'cache_ttl_seconds' => env('INAPP_VALIDATION_CACHE_TTL', 300),

        /*
        |----------------------------------------------------------------------
        | Apple App Store Server API
        |----------------------------------------------------------------------
        |
        | Required for iOS server-side validation.
        |
        | Explicit APPLE_* vars always take precedence. If they are absent the
        | plugin falls back to the NativePHP / App Store API vars that many
        | projects already set for their build pipeline.
        |
        | private_key  — PEM string (raw multiline or base64-encoded).
        |                Supports literal \n in .env values.
        | key_path     — Absolute/relative path to a .p8 file on the server
        |                filesystem. Used when private_key is absent.
        |                ⚠ FILE PATH ONLY — do not ship private keys inside
        |                  a mobile app build. Use this in backend/CI only.
        |
        */
        'apple' => [
            // Specific APPLE_* vars take precedence; NativePHP vars as fallback.
            'bundle_id' => env('APPLE_BUNDLE_ID') ?? env('NATIVEPHP_APP_ID'),
            'issuer_id' => env('APPLE_ISSUER_ID') ?? env('APP_STORE_API_ISSUER_ID'),
            'key_id' => env('APPLE_KEY_ID') ?? env('APP_STORE_API_KEY_ID'),
            'private_key' => env('APPLE_PRIVATE_KEY'),            // PEM string (value)
            'key_path' => env('APP_STORE_API_KEY_PATH'),        // path to .p8 file
            'environment' => env('APPLE_IAP_ENV', 'production'),   // 'production' or 'sandbox'
        ],

        /*
        |----------------------------------------------------------------------
        | Google Play Developer API
        |----------------------------------------------------------------------
        |
        | Required for Android server-side validation.
        |
        | service_account_json — Either:
        |                          • The raw JSON string of the service account key
        |                          • An absolute filesystem path to the JSON file
        |
        | The service account must have the "Android Publisher" API role in
        | Google Cloud Console and the Android Publisher API enabled.
        |
        | NOTE: Android expiration accuracy requires purchaseToken (automatically
        | included in transactions from plugin v1.1+). If purchaseToken is absent,
        | server validation is skipped with status 'unverified'.
        |
        */
        'google' => [
            // GOOGLE_PLAY_PACKAGE_NAME takes precedence; NATIVEPHP_APP_ID as fallback.
            'package_name' => env('GOOGLE_PLAY_PACKAGE_NAME') ?? env('NATIVEPHP_APP_ID'),
            'service_account_json' => env('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
        ],

    ],

];
