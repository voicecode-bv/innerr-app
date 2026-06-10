import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import { installNativeRouterBridge } from './nativeBridge';

type WindowWithRouter = Window & { router?: { visit(path: string): void } };

function fakeRouter(currentPath: string): {
    router: Router;
    push: ReturnType<typeof vi.fn>;
} {
    const push = vi.fn(() => Promise.resolve());
    const router = {
        resolve: (path: string) => ({ path }),
        currentRoute: { value: { path: currentPath } },
        push,
    } as unknown as Router;

    return { router, push };
}

afterEach(() => {
    delete (window as WindowWithRouter).router;
    vi.restoreAllMocks();
});

describe('installNativeRouterBridge', () => {
    it('exposes window.router.visit so the native deeplink router can navigate', () => {
        const { router } = fakeRouter('/welcome');

        installNativeRouterBridge(router);

        expect(typeof (window as WindowWithRouter).router?.visit).toBe(
            'function',
        );
    });

    it('pushes the deeplink path onto the SPA router (e.g. the OAuth callback)', () => {
        const { router, push } = fakeRouter('/welcome');

        installNativeRouterBridge(router);
        (window as WindowWithRouter).router!.visit('/oauth-callback?token=abc');

        expect(push).toHaveBeenCalledWith('/oauth-callback?token=abc');
    });

    it('reselects (scroll-to-top) instead of pushing when already on the target route', () => {
        const { router, push } = fakeRouter('/oauth-callback');
        const dispatch = vi.spyOn(window, 'dispatchEvent');

        installNativeRouterBridge(router);
        (window as WindowWithRouter).router!.visit('/oauth-callback');

        expect(push).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'spa:tab-reselect' }),
        );
    });

    it('swallows guarded/duplicate navigation rejections', async () => {
        const { router } = fakeRouter('/welcome');
        (router.push as ReturnType<typeof vi.fn>).mockReturnValue(
            Promise.reject(new Error('redundant navigation')),
        );

        installNativeRouterBridge(router);

        expect(() =>
            (window as WindowWithRouter).router!.visit('/feed'),
        ).not.toThrow();
        await Promise.resolve();
    });
});
