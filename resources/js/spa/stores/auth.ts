import { defineStore } from 'pinia';
import {
    HAS_AUTHENTICATED_KEY,
    secureStorage,
    TOKEN_KEY,
} from '@/spa/composables/useSecureStorage';
import { api } from '@/spa/http/apiClient';
import { useCirclesStore } from '@/spa/stores/circles';
import { useCommentsCacheStore } from '@/spa/stores/commentsCache';
import { useDefaultCirclesStore } from '@/spa/stores/defaultCircles';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { useNotificationPreferencesStore } from '@/spa/stores/notificationPreferences';
import { useNotificationsStore } from '@/spa/stores/notifications';
import { usePersonsStore } from '@/spa/stores/persons';
import { usePostCacheStore } from '@/spa/stores/postCache';
import { useTagsStore } from '@/spa/stores/tags';

export type FeedLayout = 'list' | 'masonry';

export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    avatar: string | null;
    bio: string | null;
    locale: string;
    // Null until the user picks a home feed layout; the client then defaults
    // to masonry and shows a one-time chooser.
    feed_layout: FeedLayout | null;
    onboarded: boolean;
    email_verified: boolean;
    // Grandfathered accounts return false: they never have to verify.
    email_verification_required: boolean;
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
        // True zodra dit toestel ooit succesvol heeft ingelogd. Blijft true na
        // uitloggen, zodat terugkerende gebruikers het welkomstkeuzescherm
        // overslaan en direct op inloggen landen.
        hasAuthenticatedBefore: false,
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
        // Laadt de durable "ooit ingelogd"-marker uit de Keychain. Moet vóór de
        // eerste routing-beslissing klaar zijn zodat de guard synchroon kan
        // kiezen tussen welkomstscherm (nieuw) en inloggen (terugkerend).
        async restoreHasAuthenticated(): Promise<void> {
            const stored = await secureStorage.get(HAS_AUTHENTICATED_KEY);

            if (stored) {
                this.hasAuthenticatedBefore = true;
            }
        },
        // Markeert dit toestel als "heeft ooit ingelogd". Idempotent: schrijft
        // alleen naar de Keychain als de marker er nog niet stond.
        async markAuthenticated(): Promise<void> {
            if (this.hasAuthenticatedBefore) {
                return;
            }

            this.hasAuthenticatedBefore = true;
            await secureStorage.set(HAS_AUTHENTICATED_KEY, '1');
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
            }

            // Een terugkerende sessie telt ook als "ooit ingelogd": markeer het
            // toestel zodat een latere logout op inloggen landt, niet op welkom.
            if (data.user) {
                await this.markAuthenticated();
            }
            // Wis het durable token hier bewust NIET als de BFF er geen
            // teruggeeft: tijdens een cold-start kan `restoreToken()` even
            // gefaald hebben (Keychain nog niet leesbaar), waardoor `this.token`
            // null is terwijl er wel degelijk een geldig token in de Keychain
            // staat. Het token verwijderen we alleen bij een expliciete logout.

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
            await this.markAuthenticated();

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
            await this.markAuthenticated();

            return { redirect_to: data.redirect_to };
        },
        async verifyEmail(code: string): Promise<void> {
            const data = await api.post<{ user: User }>(
                '/api/spa/auth/email/verify',
                { code },
            );
            this.user = data.user;
        },
        async resendEmailVerification(): Promise<void> {
            await api.post('/api/spa/auth/email/resend');
        },
        async logout(): Promise<void> {
            try {
                await api.post('/api/spa/auth/logout');
            } finally {
                // Expliciete logout: het durable token mag nu wel weg.
                this.clear(true);
            }
        },
        // Houden we sync zodat http-client `clear: () => void` callbacks blijven
        // werken; de Keychain-wipe is fire-and-forget.
        //
        // `forgetToken` wist het token uit de Keychain. Standaard false: een 401
        // (transient of door een verlopen token) mag het durable token NIET
        // verwijderen, anders verandert een tijdelijke leesfout na een herstart
        // in een permanente uitlog. Alleen een expliciete logout zet dit op true.
        clear(forgetToken = false): void {
            this.user = null;
            this.token = null;

            if (forgetToken) {
                void secureStorage.delete(TOKEN_KEY);
            }

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
