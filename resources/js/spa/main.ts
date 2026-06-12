import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { withTimeout } from '@/lib/withTimeout';
import App from '@/spa/App.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import {
    ApiError,
    NetworkError,
    configureApiClient,
} from '@/spa/http/apiClient';
import { configureExternalApi } from '@/spa/http/externalApi';
import { router } from '@/spa/router';
import { installNativeRouterBridge } from '@/spa/router/nativeBridge';
import { useAppearanceStore } from '@/spa/stores/appearance';
import { useAuthStore } from '@/spa/stores/auth';
import { useI18nStore } from '@/spa/stores/i18n';
import { useServiceKeysStore } from '@/spa/stores/serviceKeys';
import {
    AnimatedSplash,
    resolveSplashConfig,
} from '@voicecode-bv/nativephp-animated-splash';
import type { ResolvedSplashConfig } from '@voicecode-bv/nativephp-animated-splash';

function inferInitialLocale(): string {
    if (typeof window === 'undefined') {
        return 'en';
    }

    const stored = window.localStorage?.getItem('spa.locale');

    if (stored === 'en' || stored === 'nl') {
        return stored;
    }

    const browser = (window.navigator?.language ?? '')
        .slice(0, 2)
        .toLowerCase();

    return browser === 'nl' ? 'nl' : 'en';
}

// Resolve the animated-splash config once, for the theme that was applied
// pre-paint by the inline script in spa.blade.php. Returns null on plain web
// builds (no @animatedSplashConfig directive) so the splash helpers no-op.
const splashConfig: ResolvedSplashConfig | null =
    typeof window !== 'undefined'
        ? resolveSplashConfig(
              document.documentElement.classList.contains('dark'),
          )
        : null;

let splashShownAt = 0;

// auth.bootstrap() is a fetch against the local BFF without a client-side
// timeout. If it hangs, the app would sit behind the splash forever. Bounded,
// a hang behaves like an unreachable server: the reconnect screen when a
// token exists, the normal login flow otherwise. The late result of the
// original fetch is ignored; the reconnect overlay re-bootstraps on retry.
const BOOTSTRAP_TIMEOUT_MS = 10000;

/**
 * Show the native splash overlay and hold the logo on its first frame while the
 * app boots. No-ops on web/desktop where the native bridge is absent.
 */
async function showStartupSplash(): Promise<void> {
    if (!splashConfig) {
        return;
    }

    splashShownAt = Date.now();

    await AnimatedSplash.show({
        source: splashConfig.source,
        backgroundColor: splashConfig.backgroundColor,
        contentMode: splashConfig.contentMode,
        autoplay: splashConfig.autoplay,
    }).catch(() => false);
}

/**
 * Play the branded out-animation and remove the overlay once the app is ready,
 * honouring the configured minimum visible time to avoid a flash on fast boots.
 */
async function hideStartupSplash(): Promise<void> {
    if (!splashConfig) {
        return;
    }

    const elapsed = Date.now() - splashShownAt;
    const remaining = splashConfig.minVisibleMs - elapsed;

    if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
    }

    await AnimatedSplash.hide({
        fadeOutDuration: splashConfig.fadeOutMs,
        playToEnd: splashConfig.playToEnd,
    }).catch(() => false);
}

async function bootstrap(): Promise<void> {
    void showStartupSplash();

    const app = createApp(App);
    const pinia = createPinia();

    app.use(pinia);

    // Hydrate dark-mode state from localStorage + system preference.
    // The inline script in spa.blade.php already toggled the `dark` class
    // pre-paint; this call wires up the reactive store and media-query
    // listener so toggles from Settings propagate everywhere.
    useAppearanceStore().init();

    const auth = useAuthStore();
    const i18n = useI18nStore();

    const initialLocale = inferInitialLocale();
    await i18n.load(initialLocale);

    // Trigger NativePHP platform detection as early as possible so iOS-only
    // routes and links can render immediately without flicker.
    usePlatform()
        .ensureDetected()
        .catch(() => null);

    // Read the token from the Keychain (or localStorage fallback) so
    // externalApi can already send a Bearer before the BFF bootstrap call.
    // Prevents logging out when the Laravel session has expired but the token
    // is still valid. An unreadable bridge sets `auth.storageUnavailable`.
    await auth.restoreFromStorage();

    configureApiClient({
        auth: () => ({
            token: auth.token,
            clear: () => auth.clear(),
        }),
        locale: () => i18n.locale,
        onUnauthorized: () => {
            router.push({ name: 'spa.login' });
        },
    });

    // Configure externalApi up front with a lazily-read base URL (snapshot or
    // bootstrap). Outside the try, so external calls also work when the
    // bootstrap call itself fails (offline).
    configureExternalApi({
        baseUrl: () => auth.apiBase,
        auth: () => ({ token: auth.token, clear: () => auth.clear() }),
        locale: () => i18n.locale,
        appVersion: () => auth.appVersion,
        onUnauthorized: () => {
            router.push({ name: 'spa.login' });
        },
    });

    try {
        const data = await withTimeout(
            auth.bootstrap(),
            BOOTSTRAP_TIMEOUT_MS,
            () => new NetworkError('Bootstrap timed out'),
        );

        if (data.locale && data.locale !== i18n.locale) {
            await i18n.load(data.locale);
        }

        // Pre-warm service keys (Mapbox token etc.) in parallel so the first
        // Map page visit doesn't have to wait on a network round trip.
        if (auth.user) {
            useServiceKeysStore()
                .ensureLoaded()
                .catch(() => null);
        }
    } catch (error) {
        // Only a real network error (BFF unreachable) is a connectivity
        // problem we handle via the reconnect screen. A server error (500
        // etc.) is a bug, not a hiccup: we let it fall through so the guards
        // go to login as usual instead of trapping the user on the reconnect
        // screen.
        if (auth.token && error instanceof NetworkError) {
            auth.awaitingConnection = true;
        }
    }

    // If the Keychain could not be read, a valid token may exist that we
    // didn't see (yet). Don't fall back to welcome/login: enter reconnect
    // mode so the overlay retries the Keychain read.
    if (auth.storageUnavailable && !auth.user) {
        auth.awaitingConnection = true;
    }

    // Global error tap: validation/auth errors are handled by the pages
    // themselves and not funneled through here. Unexpected network/server
    // errors are only logged in dev.
    app.config.errorHandler = (err) => {
        if (err instanceof NetworkError || err instanceof ApiError) {
            return;
        }

        if (import.meta.env.DEV) {
            console.error(err);
        }
    };

    app.use(router);

    // Expose `window.router.visit` so the native shell can handle incoming
    // deeplinks (including the OAuth callback on a warm app) on the SPA side.
    // See installNativeRouterBridge for the details.
    installNativeRouterBridge(router);

    await router.isReady();

    if (typeof window !== 'undefined') {
        // In NativePhp the router uses createMemoryHistory(), which always
        // starts at '/' and ignores the WebView URL. On a cold-start deeplink
        // (e.g. /join/<token>) we have to push the router to the real path
        // explicitly, otherwise the user sees the Feed/Login instead of the
        // invite landing screen.
        const initialPath = window.location.pathname + window.location.search;

        if (
            initialPath !== '/' &&
            router.currentRoute.value.fullPath !== initialPath
        ) {
            await router.replace(initialPath).catch(() => {
                /* ignore guarded/duplicate navigation */
            });
        }

        const url = new URL(window.location.href);

        if (url.searchParams.get('oauth') === 'success') {
            url.searchParams.delete('oauth');
            window.history.replaceState({}, '', url.toString());

            if (auth.user) {
                router.replace({ name: 'spa.home' });
            }
        }
    }

    app.mount('#spa-app');

    void hideStartupSplash();
}

bootstrap().catch(() => {
    // Bootstrap threw before mounting; make sure the splash never gets stuck.
    void hideStartupSplash();
});
