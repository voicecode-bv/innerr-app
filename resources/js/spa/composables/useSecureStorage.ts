import { SecureStorage } from '@nativephp/mobile';
import { isNativeRuntime } from '@/spa/composables/usePlatform';

// Keychain-entry waar de SPA het externe-API Bearer token opslaat. Moet
// overeenkomen met `config/api-client.php#token_key` zodat de PHP-zijde
// SecureStorageTokenStore dezelfde entry leest tijdens de migratie-fase.
export const TOKEN_KEY = 'api_token';

// Durable marker that survives logout: records that this device has completed a
// successful sign-in at least once. Used to skip the first-run welcome chooser
// for returning users (even after they log out). Stored in the Keychain so it
// reliably persists across native relaunches, just like the token.
export const HAS_AUTHENTICATED_KEY = 'has_authenticated';

const FALLBACK_PREFIX = 'spa.secure.';

// Tijdens een cold-start kan de Keychain-bridge nog niet klaar zijn (bridge
// nog niet opgezet, of Keychain-items met WhenUnlocked-accessibility zijn na
// een reboot pas leesbaar ná de eerste unlock). We retryen daarom een paar
// keer voordat we opgeven, in plaats van een geldig token als "afwezig" te
// behandelen en de gebruiker uit te loggen.
const NATIVE_RETRIES = 5;
const NATIVE_RETRY_DELAY_MS = 120;

function fallbackKey(key: string): string {
    return `${FALLBACK_PREFIX}${key}`;
}

function localGet(key: string): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage?.getItem(fallbackKey(key)) ?? null;
}

function localSet(key: string, value: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage?.setItem(fallbackKey(key), value);
}

function localDelete(key: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage?.removeItem(fallbackKey(key));
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined') {
            resolve();

            return;
        }

        window.setTimeout(resolve, ms);
    });
}

/**
 * Move a token that still lives in localStorage (from before tokens were kept
 * in the Keychain) into the Keychain so existing users are not logged out.
 * Only called once the bridge has confirmed the Keychain is genuinely empty.
 */
async function migrateLegacyToken(key: string): Promise<string | null> {
    const legacy = localGet(key);

    if (!legacy) {
        return null;
    }

    try {
        await SecureStorage.set(key, legacy);
        localDelete(key);
    } catch {
        // Migratie mislukt, laat de localStorage-kopie staan voor de volgende
        // poging.
    }

    return legacy;
}

// We detecteren de native context synchroon via `isNativeRuntime()` (php:// of
// 127.0.0.1), niet via een window-vlag. Op het toestel is de Keychain de enige
// duurzame store: een bridge-fout is een timing-probleem dat we retryen, we
// vallen daar bewust NIET terug op het niet-duurzame WKWebView-localStorage,
// want dat zou een geldig token als afwezig zien. Op web/desktop is
// localStorage de enige store.
export const secureStorage = {
    async get(key: string): Promise<string | null> {
        if (!isNativeRuntime()) {
            return localGet(key);
        }

        for (let attempt = 0; attempt < NATIVE_RETRIES; attempt += 1) {
            try {
                const result = (await SecureStorage.get(key)) as {
                    value?: string | null;
                } | null;
                const stored = result?.value;

                if (typeof stored === 'string' && stored !== '') {
                    return stored;
                }

                // Bridge antwoordde succesvol met een lege waarde: er staat echt
                // niets in de Keychain. Migreer een eventueel legacy-token.
                return await migrateLegacyToken(key);
            } catch {
                // Bridge nog niet klaar: kort wachten en opnieuw proberen.
                if (attempt < NATIVE_RETRIES - 1) {
                    await delay(NATIVE_RETRY_DELAY_MS);
                }
            }
        }

        // Bridge bleef onbereikbaar. Geef null terug, maar wis niets: de
        // aanroeper mag dit niet als "geen token" interpreteren en de Keychain
        // leegmaken. Een volgende cold-start leest het token alsnog.
        return null;
    },

    async set(key: string, value: string): Promise<void> {
        if (!isNativeRuntime()) {
            localSet(key, value);

            return;
        }

        for (let attempt = 0; attempt < NATIVE_RETRIES; attempt += 1) {
            try {
                await SecureStorage.set(key, value);

                return;
            } catch {
                if (attempt < NATIVE_RETRIES - 1) {
                    await delay(NATIVE_RETRY_DELAY_MS);
                }
            }
        }
    },

    async delete(key: string): Promise<void> {
        if (!isNativeRuntime()) {
            localDelete(key);

            return;
        }

        try {
            await SecureStorage.delete(key);
        } catch {
            // Best-effort delete.
        }

        // Ruim ook een eventuele legacy localStorage-kopie op.
        localDelete(key);
    },
};
