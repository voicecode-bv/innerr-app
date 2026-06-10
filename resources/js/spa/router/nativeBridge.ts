import type { Router } from 'vue-router';

/**
 * Stelt `window.router.visit(path)` beschikbaar zodat de native shell
 * (DeepLinkRouter → ContentView.navigateWithInertia) een binnenkomende deeplink
 * SPA-side kan afhandelen terwijl de app al draait.
 *
 * Belangrijk voor o.a. de OAuth-callback: `Browser.auth`
 * (ASWebAuthenticationSession) houdt de app warm, dus de callback
 * `innerrapp://oauth-callback?token=…` komt binnen via deze visit-aanroep i.p.v.
 * een volledige reload. Ontbreekt deze shim, dan valt de native code terug op
 * `window.location.href`, wat onder het iOS `php://`-scheme met memory-history de
 * SPA niet op de juiste route landt en de gebruiker terug op het inlogscherm
 * achterlaat.
 */
export function installNativeRouterBridge(router: Router): void {
    if (typeof window === 'undefined') {
        return;
    }

    (
        window as unknown as { router: { visit: (path: string) => void } }
    ).router = {
        visit(path: string) {
            // Tik op de route waar je al bent: geen (afgewezen) push, maar de
            // huidige pagina naar boven scrollen — standaard mobiel gedrag.
            if (router.resolve(path).path === router.currentRoute.value.path) {
                window.dispatchEvent(new CustomEvent('spa:tab-reselect'));

                return;
            }

            router.push(path).catch(() => {
                /* navigatie geguard of dubbel */
            });
        },
    };
}
