import { SecureStorage } from '@nativephp/mobile';

// Keychain-entry waar de SPA het externe-API Bearer token opslaat. Moet
// overeenkomen met `config/api-client.php#token_key` zodat de PHP-zijde
// SecureStorageTokenStore dezelfde entry leest tijdens de migratie-fase.
export const TOKEN_KEY = 'api_token';

const FALLBACK_PREFIX = 'spa.secure.';

function isNativePhp(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
        (window as unknown as { __nativephp?: unknown }).__nativephp,
    );
}

function fallbackKey(key: string): string {
    return `${FALLBACK_PREFIX}${key}`;
}

export const secureStorage = {
    async get(key: string): Promise<string | null> {
        if (isNativePhp()) {
            try {
                const result = await SecureStorage.get(key);
                if (result?.value !== undefined && result?.value !== null) {
                    return result.value;
                }
            } catch {
                // Native bridge niet beschikbaar — val terug op localStorage.
            }
        }
        if (typeof window === 'undefined') return null;
        return window.localStorage?.getItem(fallbackKey(key)) ?? null;
    },

    async set(key: string, value: string): Promise<void> {
        if (isNativePhp()) {
            try {
                await SecureStorage.set(key, value);
                return;
            } catch {
                // Bridge niet beschikbaar — fallback hieronder.
            }
        }
        if (typeof window === 'undefined') return;
        window.localStorage?.setItem(fallbackKey(key), value);
    },

    async delete(key: string): Promise<void> {
        if (isNativePhp()) {
            try {
                await SecureStorage.delete(key);
            } catch {
                // Negeren — best-effort delete.
            }
        }
        if (typeof window === 'undefined') return;
        window.localStorage?.removeItem(fallbackKey(key));
    },
};
