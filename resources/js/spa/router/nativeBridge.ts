import type { Router } from 'vue-router';

/**
 * Exposes `window.router.visit(path)` so the native shell
 * (DeepLinkRouter → ContentView.navigateWithInertia) can handle an incoming
 * deeplink SPA-side while the app is already running.
 *
 * Important for, among others, the OAuth callback: `Browser.auth`
 * (ASWebAuthenticationSession) keeps the app warm, so the callback
 * `innerrapp://oauth-callback?token=…` arrives via this visit call instead of
 * a full reload. Without this shim, the native code falls back to
 * `window.location.href`, which under the iOS `php://` scheme with memory
 * history does not land the SPA on the right route and leaves the user back
 * on the login screen.
 */
export function installNativeRouterBridge(router: Router): void {
    if (typeof window === 'undefined') {
        return;
    }

    (
        window as unknown as { router: { visit: (path: string) => void } }
    ).router = {
        visit(path: string) {
            // Tapping the route you are already on: no (rejected) push, but
            // scroll the current page to the top — standard mobile behavior.
            if (router.resolve(path).path === router.currentRoute.value.path) {
                window.dispatchEvent(new CustomEvent('spa:tab-reselect'));

                return;
            }

            router.push(path).catch(() => {
                /* navigation guarded or duplicate */
            });
        },
    };
}
