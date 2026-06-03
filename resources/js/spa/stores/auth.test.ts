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

    it('keeps the restored token when bootstrap returns no token', async () => {
        // Simulate a cold-start where the Keychain token was restored but the
        // Laravel session expired, so the BFF returns no token.
        apiGet.mockResolvedValue({
            user: null,
            token: null,
            locale: 'nl',
            api_base: 'https://api.innerr.app',
            app_version: '1.0.0',
            social_auth_urls: { google: '', apple: '' },
        });

        const auth = useAuthStore();
        auth.token = 'restored-token';

        await auth.bootstrap();

        expect(auth.token).toBe('restored-token');
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
