import { defineStore } from 'pinia';
import {
    secureStorage,
    SecureStorageUnavailableError,
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
    // Furthest completed onboarding step (only set while not onboarded), so
    // the router can resume mid-flow. Optional: an older BFF omits it.
    onboarding_step?: string | null;
    email_verified: boolean;
    // Grandfathered accounts return false: they never have to verify.
    email_verification_required: boolean;
}

type AuthStatus = 'authenticated' | 'unreachable' | 'unauthenticated';

interface BootstrapPayload {
    user: User | null;
    token: string | null;
    // 'authenticated'   -> user confirmed, render the app.
    // 'unreachable'      -> token still valid but external API unreachable; show
    //                       the reconnect screen instead of logging out.
    // 'unauthenticated'  -> definitively logged out (no/rejected token).
    // Optional for forward-compat: if the field is missing, we derive it from
    // the presence of `user`.
    auth_status?: AuthStatus;
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
        // True when we hold a token but the bootstrap could not confirm the
        // user because the external API was unreachable. The app then shows
        // the reconnect screen instead of sending the user to login; a valid
        // token never leads to a forced re-login.
        awaitingConnection: false,
        // True when the Keychain bridge gave no definitive answer during a
        // cold start: a valid token may exist that we could not (yet) read.
        // We NEVER treat this as "logged out" but show the reconnect screen,
        // which retries the Keychain read.
        storageUnavailable: false,
    }),
    actions: {
        // Reads the token from the Keychain and sets `storageUnavailable` if
        // the bridge gave no definitive answer. Called early in `main.ts`
        // (before the BFF bootstrap) and again by the reconnect screen, so an
        // initially failed read can still recover instead of logging the user
        // out.
        async restoreFromStorage(): Promise<void> {
            this.storageUnavailable = false;
            await this.restoreToken();
        },
        // Called early so externalApi can already send a Bearer during cold
        // start. An unreadable bridge sets `storageUnavailable` instead of
        // treating the token as absent.
        async restoreToken(): Promise<void> {
            try {
                const stored = await secureStorage.get(TOKEN_KEY);

                if (stored) {
                    this.token = stored;
                }
            } catch (error) {
                if (error instanceof SecureStorageUnavailableError) {
                    this.storageUnavailable = true;

                    return;
                }

                throw error;
            }
        },
        async bootstrap(): Promise<BootstrapPayload> {
            const data = await api.get<BootstrapPayload>('/api/spa/bootstrap');

            // api_base/app_version/social_auth_urls come from server config and
            // are always present regardless of auth status; adopt immediately.
            this.apiBase = data.api_base;
            this.appVersion = data.app_version;
            this.socialAuthUrls = data.social_auth_urls;

            // Forward-compat: derive the status if the BFF does not (yet) send
            // the field.
            const status: AuthStatus =
                data.auth_status ??
                (data.user ? 'authenticated' : 'unauthenticated');

            // Never clear the token here: on a cold start `restoreToken()` may
            // have failed briefly (Keychain not yet readable). The token only
            // disappears on an explicit logout or a definitive rejection.
            if (data.token) {
                this.token = data.token;
                await secureStorage.set(TOKEN_KEY, data.token);
            }

            if (status === 'unreachable') {
                // External API unreachable but token still valid. Do not log
                // out: mark that we are waiting for a connection so the app
                // shows the reconnect screen and retries.
                this.awaitingConnection = !!this.token;

                return data;
            }

            // authenticated or unauthenticated: the status is definitively confirmed.
            this.awaitingConnection = false;

            if (status === 'unauthenticated') {
                this.user = null;

                // If we could not read the Keychain, this "unauthenticated" is
                // not to be trusted: no Bearer was sent along. Stay in reconnect
                // mode so the overlay keeps retrying the Keychain read instead
                // of sending the user to welcome/login.
                if (this.storageUnavailable) {
                    this.awaitingConnection = true;
                }

                return data;
            }

            // authenticated
            this.user = data.user;

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
            this.awaitingConnection = false;
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
            this.awaitingConnection = false;
            await secureStorage.set(TOKEN_KEY, data.token);

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
                // Explicit logout: the durable token may now be removed.
                this.clear(true);
            }
        },
        // Kept sync so http-client `clear: () => void` callbacks keep working;
        // the Keychain wipe is fire-and-forget.
        //
        // `forgetToken` erases the token from the Keychain. Default false: a 401
        // (transient or due to an expired token) must NOT delete the durable
        // token, otherwise a temporary read failure after a restart turns into
        // a permanent logout. Only an explicit logout sets this to true.
        clear(forgetToken = false): void {
            this.user = null;
            this.token = null;
            // A 401 (or logout) is a definitive auth outcome, not a connection
            // or storage problem: never stay stuck in reconnect mode.
            this.awaitingConnection = false;
            this.storageUnavailable = false;

            if (forgetToken) {
                void secureStorage.delete(TOKEN_KEY);
            }

            // Empty resource caches so a next session/user does not see stale
            // data.
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
