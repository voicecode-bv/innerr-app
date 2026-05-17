import { defineStore } from 'pinia';
import { api } from '@/spa/http/apiClient';
import { secureStorage, TOKEN_KEY } from '@/spa/composables/useSecureStorage';
import { useCirclesStore } from '@/spa/stores/circles';
import { useCommentsCacheStore } from '@/spa/stores/commentsCache';
import { useDefaultCirclesStore } from '@/spa/stores/defaultCircles';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { useNotificationPreferencesStore } from '@/spa/stores/notificationPreferences';
import { useNotificationsStore } from '@/spa/stores/notifications';
import { usePersonsStore } from '@/spa/stores/persons';
import { usePostCacheStore } from '@/spa/stores/postCache';
import { useTagsStore } from '@/spa/stores/tags';

export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    avatar: string | null;
    bio: string | null;
    locale: string;
    onboarded: boolean;
}

interface BootstrapPayload {
    user: User | null;
    token: string | null;
    locale: string;
    api_base: string;
    app_version: string;
    social_auth_urls: { google: string; apple: string };
}

export const useAuthStore = defineStore('spa-auth', {
    state: () => ({
        user: null as User | null,
        token: null as string | null,
        apiBase: '' as string,
        appVersion: '' as string,
        socialAuthUrls: { google: '', apple: '' },
    }),
    actions: {
        // Wordt vroeg in `main.ts` aangeroepen, vóór de BFF bootstrap-call,
        // zodat externalApi al een Bearer kan sturen tijdens cold-start.
        async restoreToken(): Promise<void> {
            const stored = await secureStorage.get(TOKEN_KEY);
            if (stored) {
                this.token = stored;
            }
        },
        async bootstrap(): Promise<BootstrapPayload> {
            const data = await api.get<BootstrapPayload>('/api/spa/bootstrap');
            this.user = data.user;
            this.apiBase = data.api_base;
            this.appVersion = data.app_version;
            this.socialAuthUrls = data.social_auth_urls;

            // BFF token blijft de bron van waarheid voor backwards-compat.
            // Sync naar Keychain zodat we de volgende cold-start direct kunnen
            // booten zonder BFF round-trip nodig te hebben.
            if (data.token) {
                this.token = data.token;
                await secureStorage.set(TOKEN_KEY, data.token);
            } else if (!this.token) {
                // Geen token in BFF en geen lokaal — niets te bewaren.
                await secureStorage.delete(TOKEN_KEY);
            }
            return data;
        },
        async login(
            email: string,
            password: string,
        ): Promise<{ redirect_to: string }> {
            const data = await api.post<{
                user: User;
                token: string;
                redirect_to: string;
            }>('/api/spa/auth/login', { email, password });
            this.user = data.user;
            this.token = data.token;
            await secureStorage.set(TOKEN_KEY, data.token);
            return { redirect_to: data.redirect_to };
        },
        async register(payload: {
            name: string;
            username: string;
            email: string;
            password: string;
            terms_accepted: boolean;
        }): Promise<{ redirect_to: string }> {
            const data = await api.post<{
                user: User;
                token: string;
                redirect_to: string;
            }>('/api/spa/auth/register', payload);
            this.user = data.user;
            this.token = data.token;
            await secureStorage.set(TOKEN_KEY, data.token);
            return { redirect_to: data.redirect_to };
        },
        async logout(): Promise<void> {
            try {
                await api.post('/api/spa/auth/logout');
            } finally {
                this.clear();
            }
        },
        // Houden we sync zodat http-client `clear: () => void` callbacks blijven
        // werken; de Keychain-wipe is fire-and-forget.
        clear(): void {
            this.user = null;
            this.token = null;
            void secureStorage.delete(TOKEN_KEY);
            // Resource-caches leegmaken zodat een volgende sessie/gebruiker
            // niet stale data ziet.
            useCirclesStore().clear();
            usePersonsStore().clear();
            useTagsStore().clear();
            useDefaultCirclesStore().clear();
            useNotificationPreferencesStore().clear();
            useNotificationsStore().clear();
            useFeedCacheStore().clear();
            usePostCacheStore().clear();
            useCommentsCacheStore().clear();
        },
    },
});
