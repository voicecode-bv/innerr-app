import { withTimeout } from '@/lib/withTimeout';
import { isNativeRuntime } from '@/spa/composables/usePlatform';
import { SecureStorage } from '@nativephp/mobile';

// Keychain entry where the SPA stores the external-API Bearer token. Must
// match `config/api-client.php#token_key` so the PHP-side
// SecureStorageTokenStore reads the same entry during the migration phase.
export const TOKEN_KEY = 'api_token';

const FALLBACK_PREFIX = 'spa.secure.';

// During a cold start the Keychain bridge may not be ready yet (bridge not
// set up, or Keychain items with WhenUnlocked accessibility are only
// readable after the first unlock following a reboot). We therefore retry
// with increasing backoff before giving up, instead of treating a valid
// token as "absent" and logging the user out. The total budget (~5.5s)
// falls entirely within the startup splash, so the user never notices the
// wait.
const NATIVE_RETRIES = 10;
const NATIVE_RETRY_BASE_MS = 120;
const NATIVE_RETRY_MAX_MS = 800;

// A hung bridge call never settles on its own (BridgeCall has no client-side
// timeout), so each attempt races a deadline; a hang then counts as a failed
// attempt and feeds the same backoff machinery as an outright error.
const NATIVE_ATTEMPT_TIMEOUT_MS = 1500;

// Hard ceiling per call: instant rejections keep the original ~5.5s backoff
// budget, but hanging attempts (1.5s each) would otherwise stretch the loop
// far past the startup splash. Past the deadline we stop and report
// unavailable; the reconnect overlay owns any further retries.
const NATIVE_TOTAL_BUDGET_MS = 8000;

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

function attemptWithTimeout<T>(promise: Promise<T>): Promise<T> {
    return withTimeout(
        promise,
        NATIVE_ATTEMPT_TIMEOUT_MS,
        () => new SecureStorageUnavailableError(),
    );
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
        // Migration failed, leave the localStorage copy in place for the
        // next attempt.
    }

    return legacy;
}

// We detect the native context synchronously via `isNativeRuntime()`
// (php:// or 127.0.0.1), not via a window flag. On device the Keychain is
// the only durable store: a bridge error is a timing problem that we retry,
// and we deliberately do NOT fall back to the non-durable WKWebView
// localStorage there, because that would see a valid token as absent. On
// web/desktop, localStorage is the only store.
export const secureStorage = {
    async get(key: string): Promise<string | null> {
        if (!isNativeRuntime()) {
            return localGet(key);
        }

        const startedAt = Date.now();

        for (let attempt = 0; attempt < NATIVE_RETRIES; attempt += 1) {
            try {
                const result = (await attemptWithTimeout(
                    SecureStorage.get(key),
                )) as {
                    value?: string | null;
                } | null;
                const stored = result?.value;

                if (typeof stored === 'string' && stored !== '') {
                    return stored;
                }

                // Bridge responded successfully with an empty value: there
                // really is nothing in the Keychain. Migrate any legacy token.
                return await migrateLegacyToken(key);
            } catch {
                // Bridge not ready yet: wait with increasing backoff and
                // retry, as long as the per-call budget allows another
                // attempt.
                const elapsed = Date.now() - startedAt;

                if (
                    attempt >= NATIVE_RETRIES - 1 ||
                    elapsed + backoffDelayMs(attempt) >= NATIVE_TOTAL_BUDGET_MS
                ) {
                    break;
                }

                await delay(backoffDelayMs(attempt));
            }
        }

        // Bridge stayed unreachable; we never got a definitive answer. Throw
        // explicitly instead of returning null, so the caller can tell this
        // apart from a confirmed-empty Keychain and doesn't log the user out
        // on a valid-but-unreadable token. Erase nothing.
        throw new SecureStorageUnavailableError();
    },

    async set(key: string, value: string): Promise<void> {
        if (!isNativeRuntime()) {
            localSet(key, value);

            return;
        }

        const startedAt = Date.now();

        for (let attempt = 0; attempt < NATIVE_RETRIES; attempt += 1) {
            try {
                await attemptWithTimeout(SecureStorage.set(key, value));

                return;
            } catch {
                const elapsed = Date.now() - startedAt;

                if (
                    attempt >= NATIVE_RETRIES - 1 ||
                    elapsed + backoffDelayMs(attempt) >= NATIVE_TOTAL_BUDGET_MS
                ) {
                    // Existing semantics: give up silently. The token then
                    // lives only in memory; the reconnect flow re-fetches it
                    // via the BFF session on the next launch.
                    return;
                }

                await delay(backoffDelayMs(attempt));
            }
        }
    },

    async delete(key: string): Promise<void> {
        if (!isNativeRuntime()) {
            localDelete(key);

            return;
        }

        try {
            // Bounded so a hung bridge call can never stall the logout flow.
            await attemptWithTimeout(SecureStorage.delete(key));
        } catch {
            // Best-effort delete.
        }

        // Also clean up any legacy localStorage copy.
        localDelete(key);
    },
};
