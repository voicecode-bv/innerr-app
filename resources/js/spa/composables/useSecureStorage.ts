import { SecureStorage } from '@nativephp/mobile';

// Keychain-entry waar de SPA het externe-API Bearer token opslaat. Moet
// overeenkomen met `config/api-client.php#token_key` zodat de PHP-zijde
// SecureStorageTokenStore dezelfde entry leest tijdens de migratie-fase.
export const TOKEN_KEY = 'api_token';

const FALLBACK_PREFIX = 'spa.secure.';

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

// We detecteren de native context niet via een window-vlag (die wordt in de
// huidige NativePHP-runtime niet meer gezet, waardoor het token stilletjes in
// het niet-duurzame WKWebView-localStorage belandde i.p.v. de Keychain). In
// plaats daarvan proberen we simpelweg de bridge: op het toestel slaagt de
// `/_native/api/call` fetch en gebruiken we de Keychain; op web/desktop faalt
// die en vallen we terug op localStorage.
export const secureStorage = {
    async get(key: string): Promise<string | null> {
        try {
            const result = (await SecureStorage.get(key)) as {
                value?: string | null;
            } | null;
            const stored = result?.value;

            if (typeof stored === 'string' && stored !== '') {
                return stored;
            }

            // Keychain leeg: migreer een token dat nog in localStorage staat
            // (van vóór deze fix) naar de Keychain, zodat bestaande gebruikers
            // niet onnodig uitgelogd worden.
            const legacy = localGet(key);

            if (legacy) {
                try {
                    await SecureStorage.set(key, legacy);
                    localDelete(key);
                } catch {
                    // Migratie mislukt — laat de localStorage-kopie staan.
                }
            }

            return legacy;
        } catch {
            // Bridge niet bereikbaar (web/desktop) — val terug op localStorage.
            return localGet(key);
        }
    },

    async set(key: string, value: string): Promise<void> {
        try {
            await SecureStorage.set(key, value);
        } catch {
            localSet(key, value);
        }
    },

    async delete(key: string): Promise<void> {
        try {
            await SecureStorage.delete(key);
        } catch {
            // Negeren — best-effort delete.
        }

        // Ruim ook een eventuele localStorage-kopie op, ongeacht de bridge.
        localDelete(key);
    },
};
