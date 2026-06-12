import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Controllable Keychain bridge mock. We configure get/set/delete per test.
const get = vi.fn();
const set = vi.fn();
const del = vi.fn();

vi.mock('@nativephp/mobile', () => ({
    SecureStorage: {
        get: (key: string) => get(key),
        set: (key: string, value: string) => set(key, value),
        delete: (key: string) => del(key),
    },
}));

// Controls whether the storage layer takes the native (Keychain) or web
// (localStorage) path, independent of the jsdom location.
let native = false;

vi.mock('@/spa/composables/usePlatform', () => ({
    isNativeRuntime: () => native,
}));

const { secureStorage, SecureStorageUnavailableError, TOKEN_KEY } =
    await import('./useSecureStorage');

const fallbackKey = `spa.secure.${TOKEN_KEY}`;

beforeEach(() => {
    get.mockReset();
    set.mockReset();
    del.mockReset();
    native = false;
    window.localStorage.clear();
});

afterEach(() => {
    window.localStorage.clear();
});

describe('secureStorage on a device (Keychain bridge available)', () => {
    beforeEach(() => {
        native = true;
    });

    it('returns the token stored in the Keychain', async () => {
        get.mockResolvedValue({ value: 'keychain-token' });

        await expect(secureStorage.get(TOKEN_KEY)).resolves.toBe(
            'keychain-token',
        );
    });

    it('treats an empty Keychain value as no token', async () => {
        get.mockResolvedValue({ value: '' });

        await expect(secureStorage.get(TOKEN_KEY)).resolves.toBeNull();
    });

    it('migrates a legacy localStorage token into the Keychain', async () => {
        get.mockResolvedValue({ value: '' });
        set.mockResolvedValue({ success: true });
        window.localStorage.setItem(fallbackKey, 'legacy-token');

        await expect(secureStorage.get(TOKEN_KEY)).resolves.toBe(
            'legacy-token',
        );

        expect(set).toHaveBeenCalledWith(TOKEN_KEY, 'legacy-token');
        // After migration the localStorage copy is removed.
        expect(window.localStorage.getItem(fallbackKey)).toBeNull();
    });

    it('retries a transient bridge failure before reading the token', async () => {
        get.mockRejectedValueOnce(
            new Error('bridge not ready'),
        ).mockResolvedValue({ value: 'keychain-token' });

        await expect(secureStorage.get(TOKEN_KEY)).resolves.toBe(
            'keychain-token',
        );

        expect(get.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('throws SecureStorageUnavailableError without touching localStorage when the bridge keeps failing', async () => {
        vi.useFakeTimers();
        get.mockRejectedValue(new Error('bridge down'));
        // A token still lives in the Keychain; a failed read must NOT be
        // reported as "no token" by falling back to the empty WKWebView store,
        // nor as a definitive null — it must surface as "unreadable".
        window.localStorage.setItem(fallbackKey, 'should-be-ignored');

        const promise = secureStorage.get(TOKEN_KEY);
        // Attach the rejection assertion before draining the backoff timers so
        // the rejection is never momentarily unhandled.
        const expectation = expect(promise).rejects.toBeInstanceOf(
            SecureStorageUnavailableError,
        );
        await vi.runAllTimersAsync();
        await expectation;

        // The durable copy is never wiped as a side-effect of a failed read.
        expect(del).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('treats a hanging bridge call as a failed attempt and retries', async () => {
        vi.useFakeTimers();
        // First call never settles (BridgeCall has no timeout of its own);
        // the per-attempt deadline must convert it into a retry instead of
        // leaving the app stuck behind the splash.
        get.mockImplementationOnce(
            () => new Promise(() => {}),
        ).mockResolvedValue({ value: 'keychain-token' });

        const promise = secureStorage.get(TOKEN_KEY);
        const expectation = expect(promise).resolves.toBe('keychain-token');
        await vi.runAllTimersAsync();
        await expectation;

        expect(get).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });

    it('gives up within the total budget when every bridge call hangs', async () => {
        vi.useFakeTimers();
        get.mockImplementation(() => new Promise(() => {}));

        const promise = secureStorage.get(TOKEN_KEY);
        const expectation = expect(promise).rejects.toBeInstanceOf(
            SecureStorageUnavailableError,
        );
        await vi.runAllTimersAsync();
        await expectation;

        // The ~8s budget cuts the loop well short of the full retry count:
        // hanging attempts cost 1.5s each instead of failing instantly.
        expect(get.mock.calls.length).toBeLessThan(10);
        expect(get.mock.calls.length).toBeGreaterThanOrEqual(2);
        vi.useRealTimers();
    });

    it('writes to the Keychain on set', async () => {
        set.mockResolvedValue({ success: true });

        await secureStorage.set(TOKEN_KEY, 'fresh-token');

        expect(set).toHaveBeenCalledWith(TOKEN_KEY, 'fresh-token');
        expect(window.localStorage.getItem(fallbackKey)).toBeNull();
    });

    it('retries a transient bridge failure on set', async () => {
        set.mockRejectedValueOnce(
            new Error('bridge not ready'),
        ).mockResolvedValue({ success: true });

        await secureStorage.set(TOKEN_KEY, 'fresh-token');

        expect(set.mock.calls.length).toBeGreaterThanOrEqual(2);
        // Never silently persisted to the non-durable WKWebView store.
        expect(window.localStorage.getItem(fallbackKey)).toBeNull();
    });

    it('deletes from the Keychain and clears any localStorage copy', async () => {
        del.mockResolvedValue({ success: true });
        window.localStorage.setItem(fallbackKey, 'stale');

        await secureStorage.delete(TOKEN_KEY);

        expect(del).toHaveBeenCalledWith(TOKEN_KEY);
        expect(window.localStorage.getItem(fallbackKey)).toBeNull();
    });
});

describe('secureStorage on web (no native runtime)', () => {
    it('reads from localStorage without calling the bridge', async () => {
        window.localStorage.setItem(fallbackKey, 'web-token');

        await expect(secureStorage.get(TOKEN_KEY)).resolves.toBe('web-token');
        expect(get).not.toHaveBeenCalled();
    });

    it('writes to localStorage without calling the bridge', async () => {
        await secureStorage.set(TOKEN_KEY, 'web-token');

        expect(window.localStorage.getItem(fallbackKey)).toBe('web-token');
        expect(set).not.toHaveBeenCalled();
    });
});
