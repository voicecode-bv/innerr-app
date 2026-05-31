import { flare } from '@flareapp/js';
import { flareVue } from '@flareapp/vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from '@/spa/App.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import {
    ApiError,
    NetworkError,
    configureApiClient,
} from '@/spa/http/apiClient';
import { configureExternalApi } from '@/spa/http/externalApi';
import { router } from '@/spa/router';
import { useAppearanceStore } from '@/spa/stores/appearance';
import { useAuthStore } from '@/spa/stores/auth';
import { useI18nStore } from '@/spa/stores/i18n';
import { useServiceKeysStore } from '@/spa/stores/serviceKeys';

if (typeof window !== 'undefined' && import.meta.env.PROD) {
    flare.light();
}

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

async function bootstrap(): Promise<void> {
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

    // Trigger NativePHP platform-detectie zo vroeg mogelijk zodat iOS-only
    // routes en links direct kunnen renderen zonder flicker.
    usePlatform()
        .ensureDetected()
        .catch(() => null);

    // Lees token uit Keychain (of localStorage-fallback) zodat externalApi al
    // een Bearer kan sturen vóór de BFF bootstrap-call. Voorkomt uitloggen
    // wanneer de Laravel-session verlopen is maar het token nog wél geldig is.
    await auth.restoreToken();

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

    try {
        const data = await auth.bootstrap();

        if (data.locale && data.locale !== i18n.locale) {
            await i18n.load(data.locale);
        }

        configureExternalApi({
            baseUrl: data.api_base,
            auth: () => ({ token: auth.token, clear: () => auth.clear() }),
            locale: () => i18n.locale,
            appVersion: () => auth.appVersion,
            onUnauthorized: () => {
                router.push({ name: 'spa.login' });
            },
        });

        // Pre-warm service-keys (Mapbox token etc.) parallel zodat de eerste
        // Map-page bezoek niet hoeft te wachten op een netwerk-roundtrip.
        if (auth.user) {
            useServiceKeysStore()
                .ensureLoaded()
                .catch(() => null);
        }
    } catch {
        // Bootstrap failed; route guards will redirect to login.
    }

    // Globale error-tap: validation/auth errors worden door pages zelf
    // afgehandeld en niet hier doorgesluisd. Onverwachte network/server
    // fouten alleen loggen in dev.
    app.config.errorHandler = (err) => {
        if (err instanceof NetworkError || err instanceof ApiError) {
            return;
        }

        if (import.meta.env.DEV) {
            console.error(err);
        }
    };

    app.use(router);
    app.use(flareVue);

    // NativePhp's Edge bottom-nav roept `window.router.visit(path)` aan voor
    // SPA-style navigatie en valt anders terug op `window.location.href = path`,
    // wat in createMemoryHistory-mode niets doet. Door deze shim worden taps op
    // bottom-nav-tabs als vue-router pushes afgehandeld i.p.v. een full reload.
    if (typeof window !== 'undefined') {
        (
            window as unknown as { router: { visit: (path: string) => void } }
        ).router = {
            visit(path: string) {
                // Tik op de tab waar je al bent: geen (afgewezen) push, maar de
                // huidige pagina naar boven scrollen — standaard mobiel gedrag.
                // AppLayout luistert op dit event en scrolt zijn container.
                if (
                    router.resolve(path).path === router.currentRoute.value.path
                ) {
                    window.dispatchEvent(new CustomEvent('spa:tab-reselect'));

                    return;
                }

                router.push(path).catch(() => {
                    /* navigatie geguard of dubbel */
                });
            },
        };
    }

    await router.isReady();

    if (typeof window !== 'undefined') {
        // In NativePhp gebruikt de router createMemoryHistory(), die altijd op
        // '/' start en de WebView-URL negeert. Bij een cold-start deeplink
        // (bv. /join/<token>) moeten we de router expliciet naar de echte
        // path duwen, anders ziet de gebruiker de Feed/Login i.p.v. het
        // invite-landing-scherm.
        const initialPath = window.location.pathname + window.location.search;

        if (
            initialPath !== '/' &&
            router.currentRoute.value.fullPath !== initialPath
        ) {
            await router.replace(initialPath).catch(() => {
                /* guarded/dubbele navigatie negeren */
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
}

bootstrap();
