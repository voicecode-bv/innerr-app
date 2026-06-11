import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();

vi.mock('@/spa/http/externalApi', () => ({
    externalApi: {
        get: (path: string) => apiGet(path),
    },
}));

vi.mock('@/spa/composables/usePlatform', () => ({
    usePlatform: () => ({
        isIos: { value: true },
        isAndroid: { value: false },
        ensureDetected: () => Promise.resolve(),
    }),
}));

const { useAppUpdateStore, isVersionBelow } = await import('./appUpdate');
const { useAuthStore } = await import('./auth');

beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    apiGet.mockReset();
});

describe('isVersionBelow', () => {
    it('compares numeric segments', () => {
        expect(isVersionBelow('1.2.3', '1.2.4')).toBe(true);
        expect(isVersionBelow('1.2.3', '1.3.0')).toBe(true);
        expect(isVersionBelow('1.2.3', '2.0.0')).toBe(true);
        expect(isVersionBelow('1.2.3', '1.2.3')).toBe(false);
        expect(isVersionBelow('1.2.4', '1.2.3')).toBe(false);
        expect(isVersionBelow('1.10.0', '1.9.0')).toBe(false);
    });

    it('treats missing segments as zero', () => {
        expect(isVersionBelow('1.2', '1.2.0')).toBe(false);
        expect(isVersionBelow('1.2', '1.2.1')).toBe(true);
    });

    it('is conservative on unparseable input', () => {
        expect(isVersionBelow(null, '1.0.0')).toBe(false);
        expect(isVersionBelow('1.0.0', null)).toBe(false);
        expect(isVersionBelow('abc', '1.0.0')).toBe(false);
    });
});

describe('app update store', () => {
    it('flags an available update when the store version is newer', async () => {
        apiGet.mockResolvedValue({
            data: {
                latest_version: '2.0.0',
                minimum_version: '1.0.0',
                store_url: 'https://apps.apple.com/app/id1',
            },
        });

        useAuthStore().appVersion = '1.5.0';
        const store = useAppUpdateStore();
        await store.ensureChecked();

        expect(apiGet).toHaveBeenCalledWith('/app-version?platform=ios');
        expect(store.updateAvailable).toBe(true);
        expect(store.updateRequired).toBe(false);
    });

    it('requires an update below the minimum version', async () => {
        apiGet.mockResolvedValue({
            data: {
                latest_version: '2.0.0',
                minimum_version: '1.8.0',
                store_url: 'https://apps.apple.com/app/id1',
            },
        });

        useAuthStore().appVersion = '1.5.0';
        const store = useAppUpdateStore();
        await store.ensureChecked();

        expect(store.updateRequired).toBe(true);
    });

    it('stays quiet when already on the latest version', async () => {
        apiGet.mockResolvedValue({
            data: {
                latest_version: '2.0.0',
                minimum_version: '1.0.0',
                store_url: null,
            },
        });

        useAuthStore().appVersion = '2.0.0';
        const store = useAppUpdateStore();
        await store.ensureChecked();

        expect(store.updateAvailable).toBe(false);
        expect(store.updateRequired).toBe(false);
    });

    it('hides the card after dismissing until a newer version ships', async () => {
        apiGet.mockResolvedValue({
            data: {
                latest_version: '2.0.0',
                minimum_version: '1.0.0',
                store_url: null,
            },
        });

        useAuthStore().appVersion = '1.5.0';
        const store = useAppUpdateStore();
        await store.ensureChecked();
        store.dismissCurrent();

        expect(store.updateAvailable).toBe(false);

        // A newer release replaces the dismissed one: the card returns.
        store.latestVersion = '2.1.0';
        expect(store.updateAvailable).toBe(true);
    });

    it('stays quiet when the endpoint is unavailable', async () => {
        apiGet.mockRejectedValue(new Error('offline'));

        useAuthStore().appVersion = '1.0.0';
        const store = useAppUpdateStore();
        await store.ensureChecked();

        expect(store.updateAvailable).toBe(false);
        expect(store.updateRequired).toBe(false);
    });

    it('does not recheck within the TTL', async () => {
        apiGet.mockResolvedValue({
            data: {
                latest_version: null,
                minimum_version: null,
                store_url: null,
            },
        });

        const store = useAppUpdateStore();
        await store.ensureChecked();
        await store.ensureChecked();

        expect(apiGet).toHaveBeenCalledTimes(1);
    });
});
