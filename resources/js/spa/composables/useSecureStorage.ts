import { isNativeRuntime } from '@/spa/composables/usePlatform';
import { SecureStorage } from '@nativephp/mobile';

// Keychain-entry waar de SPA het externe-API Bearer token opslaat. Moet
// overeenkomen met `config/api-client.php#token_key` zodat de PHP-zijde
// SecureStorageTokenStore dezelfde entry leest tijdens de migratie-fase.
export const TOKEN_KEY = 'api_token';

const FALLBACK_PREFIX = 'spa.secure.';

// Tijdens een cold-start kan de Keychain-bridge nog niet klaar zijn (bridge
// nog niet opgezet, of Keychain-items met WhenUnlocked-accessibility zijn na
// een reboot pas leesbaar ná de eerste unlock). We retryen daarom met
// oplopende backoff voordat we opgeven, in plaats van een geldig token als
// "afwezig" te behandelen en de gebruiker uit te loggen. Het totale budget
// (~5,5s) valt volledig binnen de opstart-splash, dus de gebruiker merkt het
// wachten niet.
const NATIVE_RETRIES = 10;
const NATIVE_RETRY_BASE_MS = 120;
const NATIVE_RETRY_MAX_MS = 800;

function backoffDelayMs(attempt: number): number {
    return Math.min(NATIVE_RETRY_BASE_MS * 2 ** attempt, NATIVE_RETRY_MAX_MS);
}

/**
 * Thrown by `secureStorage.get()` when the native bridge never returned a
 * definitive answer (every attempt failed). The caller MUST treat this as
 * "could not read", not as "no value": a valid token may still live in the
 * Keychain. Distinguishing this from a resolved-empty read (genuine absence) is
 * what keeps a transient cold-start glitch from turning into a forced logout.
 */
export class SecureStorageUnavailableError extends Error {
    constructor() {
        super('Secure storage bridge unavailable');
        this.name = 'SecureStorageUnavailableError';
    }
}

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
                // Bridge nog niet klaar: oplopend wachten en opnieuw proberen.
                if (attempt < NATIVE_RETRIES - 1) {
                    await delay(backoffDelayMs(attempt));
                }
            }
        }

        // Bridge bleef onbereikbaar; we hebben nooit een definitief antwoord
        // gekregen. Gooi expliciet i.p.v. null terug te geven, zodat de
        // aanroeper dit kan onderscheiden van een bevestigd-lege Keychain en de
        // gebruiker niet uitlogt op een geldig-maar-onleesbaar token. Wis niets.
        throw new SecureStorageUnavailableError();
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
                    await delay(backoffDelayMs(attempt));
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
