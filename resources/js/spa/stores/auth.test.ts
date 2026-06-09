import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const apiPost = vi.fn();
const storageSet = vi.fn();
const storageDelete = vi.fn();
const storageGet = vi.fn();

vi.mock('@/spa/http/apiClient', () => ({
    api: {
        get: (path: string) => apiGet(path),
        post: (path: string, body?: unknown) => apiPost(path, body),
    },
}));

vi.mock('@/spa/composables/useSecureStorage', () => ({
    TOKEN_KEY: 'api_token',
    SecureStorageUnavailableError: class SecureStorageUnavailableError extends Error {},
    secureStorage: {
        get: (key: string) => storageGet(key),
        set: (key: string, value: string) => storageSet(key, value),
        delete: (key: string) => storageDelete(key),
    },
}));

// Cache-stores die `clear()` aanroept; geïsoleerd weggemockt zodat deze test
// niet afhangt van het badge-plugin of externalApi.
const cacheStore = () => () => ({ clear: vi.fn() });

vi.mock('@/spa/stores/circles', () => ({ useCirclesStore: cacheStore() }));
vi.mock('@/spa/stores/persons', () => ({ usePersonsStore: cacheStore() }));
vi.mock('@/spa/stores/tags', () => ({ useTagsStore: cacheStore() }));
vi.mock('@/spa/stores/defaultCircles', () => ({
    useDefaultCirclesStore: cacheStore(),
}));
vi.mock('@/spa/stores/notificationPreferences', () => ({
    useNotificationPreferencesStore: cacheStore(),
}));
vi.mock('@/spa/stores/notifications', () => ({
    useNotificationsStore: cacheStore(),
}));
vi.mock('@/spa/stores/feedCache', () => ({ useFeedCacheStore: cacheStore() }));
vi.mock('@/spa/stores/postCache', () => ({ usePostCacheStore: cacheStore() }));
vi.mock('@/spa/stores/commentsCache', () => ({
    useCommentsCacheStore: cacheStore(),
}));

const { useAuthStore } = await import('./auth');
const { SecureStorageUnavailableError } =
    await import('@/spa/composables/useSecureStorage');

beforeEach(() => {
    setActivePinia(createPinia());
    apiGet.mockReset();
    apiPost.mockReset();
    storageSet.mockReset();
    storageDelete.mockReset();
    storageGet.mockReset();
});

describe('auth store token durability', () => {
    it('does NOT delete the durable token on a 401 clear()', () => {
        const auth = useAuthStore();
        auth.token = 'valid-token';
        auth.user = { id: '1' } as never;

        auth.clear();

        expect(auth.token).toBeNull();
        expect(auth.user).toBeNull();
        // A 401 must not wipe the Keychain, or a transient read failure after a
        // restart would become a permanent logout.
        expect(storageDelete).not.toHaveBeenCalled();
    });

    it('deletes the durable token on an explicit logout', async () => {
        apiPost.mockResolvedValue(undefined);
        const auth = useAuthStore();
        auth.token = 'valid-token';

        await auth.logout();

        expect(apiPost).toHaveBeenCalledWith('/api/spa/auth/logout', undefined);
        expect(storageDelete).toHaveBeenCalledWith('api_token');
        expect(auth.token).toBeNull();
    });

    it('flags awaitingConnection and keeps the token when bootstrap is unreachable', async () => {
        // Cold-start where the Keychain token was restored but the external API
        // could not confirm it (transient). The token must survive and the app
        // must enter the reconnect state instead of bouncing to login.
        apiGet.mockResolvedValue({
            user: null,
            token: 'restored-token',
            auth_status: 'unreachable',
            locale: 'nl',
            api_base: 'https://api.innerr.app',
            app_version: '1.0.0',
            social_auth_urls: { google: '', apple: '' },
        });

        const auth = useAuthStore();
        auth.token = 'restored-token';

        await auth.bootstrap();

        expect(auth.token).toBe('restored-token');
        expect(auth.awaitingConnection).toBe(true);
        // A transient must never wipe the durable token.
        expect(storageDelete).not.toHaveBeenCalled();
    });

    it('persists a fresh token returned by bootstrap', async () => {
        apiGet.mockResolvedValue({
            user: { id: '1' },
            token: 'fresh-token',
            locale: 'nl',
            api_base: 'https://api.innerr.app',
            app_version: '1.0.0',
            social_auth_urls: { google: '', apple: '' },
        });

        const auth = useAuthStore();

        await auth.bootstrap();

        expect(auth.token).toBe('fresh-token');
        expect(storageSet).toHaveBeenCalledWith('api_token', 'fresh-token');
    });
});

describe('auth store reconnect handling', () => {
    const payload = (overrides: Record<string, unknown>) => ({
        user: null,
        token: null,
        auth_status: 'unauthenticated',
        locale: 'nl',
        api_base: 'https://api.innerr.app',
        app_version: '1.0.0',
        social_auth_urls: { google: '', apple: '' },
        ...overrides,
    });

    it('clears the reconnect flag on an authenticated bootstrap', async () => {
        apiGet.mockResolvedValue(
            payload({
                auth_status: 'authenticated',
                user: { id: '7', username: 'mees' },
                token: 'fresh',
            }),
        );

        const auth = useAuthStore();
        // Simulate that we were sitting on the reconnect screen.
        auth.awaitingConnection = true;

        await auth.bootstrap();

        expect(auth.user).toEqual({ id: '7', username: 'mees' });
        expect(auth.awaitingConnection).toBe(false);
    });

    it('clears the user and reconnect flag on an unauthenticated bootstrap', async () => {
        apiGet.mockResolvedValue(payload({ auth_status: 'unauthenticated' }));

        const auth = useAuthStore();
        auth.user = { id: '7' } as never;
        auth.awaitingConnection = true;

        await auth.bootstrap();

        expect(auth.user).toBeNull();
        expect(auth.awaitingConnection).toBe(false);
    });

    it('does not enter the reconnect state on unreachable without a token', async () => {
        apiGet.mockResolvedValue(payload({ auth_status: 'unreachable' }));

        const auth = useAuthStore();
        // No token held: an unreachable result is just an offline guest, who
        // belongs on the login/welcome flow, not the reconnect screen.
        await auth.bootstrap();

        expect(auth.awaitingConnection).toBe(false);
    });

    it('stays in the reconnect state on unauthenticated when secure storage was unreadable', async () => {
        apiGet.mockResolvedValue(payload({ auth_status: 'unauthenticated' }));

        const auth = useAuthStore();
        // The Keychain read never returned: a valid token may exist but was
        // unreadable, so no Bearer was sent. This "unauthenticated" is not
        // trustworthy and must NOT drop the user to welcome/login.
        auth.storageUnavailable = true;

        await auth.bootstrap();

        expect(auth.user).toBeNull();
        expect(auth.awaitingConnection).toBe(true);
    });

    it('resets the reconnect flag on clear()', () => {
        const auth = useAuthStore();
        auth.awaitingConnection = true;

        auth.clear();

        expect(auth.awaitingConnection).toBe(false);
    });
});

describe('auth store secure-storage resilience', () => {
    it('flags storageUnavailable on an unreadable Keychain without dropping the token', async () => {
        storageGet.mockRejectedValue(new SecureStorageUnavailableError());

        const auth = useAuthStore();
        await auth.restoreToken();

        // A glitchy cold-start bridge must never look like "no token": flag it
        // so the app shows the reconnect screen instead of logging out.
        expect(auth.storageUnavailable).toBe(true);
        expect(auth.token).toBeNull();
    });

    it('restoreFromStorage clears a stale flag and reads the token', async () => {
        storageGet.mockImplementation((key: string) =>
            Promise.resolve(key === 'api_token' ? 'kc-token' : null),
        );

        const auth = useAuthStore();
        // Stale flag from an earlier failed read; a successful re-read clears it.
        auth.storageUnavailable = true;

        await auth.restoreFromStorage();

        expect(auth.storageUnavailable).toBe(false);
        expect(auth.token).toBe('kc-token');
    });
});

describe('auth store logout', () => {
    it('wipes the token from the Keychain on an explicit logout', async () => {
        apiPost.mockResolvedValue(undefined);

        const auth = useAuthStore();
        auth.token = 'tok';

        await auth.logout();

        expect(storageDelete).toHaveBeenCalledWith('api_token');
        expect(auth.token).toBeNull();
    });
});
