import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Controleerbare Keychain-bridge mock. Per test stellen we get/set/delete in.
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

// Stuurt of de storage-laag het native (Keychain) of web (localStorage) pad
// kiest, los van de jsdom-locatie.
let native = false;

vi.mock('@/spa/composables/usePlatform', () => ({
    isNativeRuntime: () => native,
}));

const { secureStorage, TOKEN_KEY } = await import('./useSecureStorage');

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

    it('returns null without touching localStorage when the bridge keeps failing', async () => {
        get.mockRejectedValue(new Error('bridge down'));
        // A token still lives in the Keychain; a failed read must NOT be
        // reported as "no token" by falling back to the empty WKWebView store.
        window.localStorage.setItem(fallbackKey, 'should-be-ignored');

        await expect(secureStorage.get(TOKEN_KEY)).resolves.toBeNull();
        // The durable copy is never wiped as a side-effect of a failed read.
        expect(del).not.toHaveBeenCalled();
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
