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

const { secureStorage, TOKEN_KEY } = await import('./useSecureStorage');

const fallbackKey = `spa.secure.${TOKEN_KEY}`;

beforeEach(() => {
    get.mockReset();
    set.mockReset();
    del.mockReset();
    window.localStorage.clear();
});

afterEach(() => {
    window.localStorage.clear();
});

describe('secureStorage on a device (Keychain bridge available)', () => {
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

    it('writes to the Keychain on set', async () => {
        set.mockResolvedValue({ success: true });

        await secureStorage.set(TOKEN_KEY, 'fresh-token');

        expect(set).toHaveBeenCalledWith(TOKEN_KEY, 'fresh-token');
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

describe('secureStorage on web (bridge throws)', () => {
    it('falls back to localStorage for get', async () => {
        get.mockRejectedValue(new Error('no bridge'));
        window.localStorage.setItem(fallbackKey, 'web-token');

        await expect(secureStorage.get(TOKEN_KEY)).resolves.toBe('web-token');
    });

    it('falls back to localStorage for set', async () => {
        set.mockRejectedValue(new Error('no bridge'));

        await secureStorage.set(TOKEN_KEY, 'web-token');

        expect(window.localStorage.getItem(fallbackKey)).toBe('web-token');
    });
});
