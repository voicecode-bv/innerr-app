import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function setUrl(url: string): void {
    (
        window as unknown as { happyDOM: { setURL(u: string): void } }
    ).happyDOM.setURL(url);
}

// The router picks its history mode synchronously at module load from
// `window.location`, so each case sets the URL and re-imports a fresh module.
// `RouterHistory.location` reflects window.location for HTML5 history but stays
// at the START location ('/') for in-memory history, which lets us assert the
// mode without navigating (the test config has no Vue SFC plugin, so loading a
// page component would fail).
beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    vi.resetModules();
});

describe('router history mode', () => {
    it('uses HTML5 history on Android native so the hardware back button can navigate', async () => {
        setUrl('http://127.0.0.1/feed');

        const { router } = await import('./index');

        expect(router.options.history.location).toBe('/feed');
    });

    it('uses HTML5 history on the web', async () => {
        setUrl('https://innerr-app.test/feed');

        const { router } = await import('./index');

        expect(router.options.history.location).toBe('/feed');
    });

    it('keeps in-memory history on the iOS php:// scheme', async () => {
        setUrl('php://127.0.0.1/feed');

        const { router } = await import('./index');

        // In-memory history ignores the WebView URL (it starts at its own START
        // location), unlike HTML5 history which mirrors window.location above.
        expect(router.options.history.location).not.toBe('/feed');
    });
});

describe('debug route', () => {
    it('is registered and publicly reachable without auth or onboarding', async () => {
        setUrl('https://innerr-app.test/');

        const { router } = await import('./index');
        const debug = router.resolve({ name: 'spa.dev.debug' });

        expect(debug.path).toBe('/dev/debug');
        // Public so the 10-tap gesture on the login logo can open it even when
        // the user appears to be logged out — must NOT require auth/onboarded.
        expect(debug.meta.public).toBe(true);
        expect(debug.meta.auth).toBeUndefined();
        expect(debug.meta.onboarded).toBeUndefined();
    });
});
