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

type AuthStatus = 'authenticated' | 'unreachable' | 'unauthenticated';

interface BootstrapPayload {
    user: User | null;
    token: string | null;
    // 'authenticated'   -> user bevestigd, render de app.
    // 'unreachable'      -> token nog geldig maar externe API onbereikbaar; toon
    //                       het reconnect-scherm i.p.v. uitloggen.
    // 'unauthenticated'  -> definitief uitgelogd (geen/afgewezen token).
    // Optioneel voor forward-compat: ontbreekt het veld, dan leiden we het af
    // uit de aanwezigheid van `user`.
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
        // True zodra dit toestel ooit succesvol heeft ingelogd. Blijft true na
        // uitloggen, zodat terugkerende gebruikers het welkomstkeuzescherm
        // overslaan en direct op inloggen landen.
        hasAuthenticatedBefore: false,
        // True wanneer we een token vasthouden maar de bootstrap de gebruiker
        // niet kon bevestigen omdat de externe API onbereikbaar was. De app
        // toont dan het reconnect-scherm i.p.v. de gebruiker naar login te
        // sturen; een geldig token leidt nooit tot een gedwongen re-login.
        awaitingConnection: false,
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

            // api_base/app_version/social_auth_urls komen uit server-config en
            // zijn er altijd, ongeacht auth-status; meteen overnemen.
            this.apiBase = data.api_base;
            this.appVersion = data.app_version;
            this.socialAuthUrls = data.social_auth_urls;

            // Forward-compat: leid de status af als de BFF het veld (nog) niet
            // meestuurt.
            const status: AuthStatus =
                data.auth_status ??
                (data.user ? 'authenticated' : 'unauthenticated');

            // Token nooit hier wissen: bij een cold-start kan `restoreToken()`
            // even gefaald hebben (Keychain nog niet leesbaar). Alleen bij een
            // expliciete logout of een definitieve afwijzing verdwijnt het token.
            if (data.token) {
                this.token = data.token;
                await secureStorage.set(TOKEN_KEY, data.token);
            }

            if (status === 'unreachable') {
                // Externe API onbereikbaar maar token nog geldig. Niet uitloggen:
                // markeer dat we op verbinding wachten zodat de app het reconnect-
                // scherm toont en het opnieuw probeert.
                this.awaitingConnection = !!this.token;

                return data;
            }

            // authenticated of unauthenticated: de status is definitief bevestigd.
            this.awaitingConnection = false;

            if (status === 'unauthenticated') {
                this.user = null;

                return data;
            }

            // authenticated
            this.user = data.user;

            if (data.user) {
                // Een terugkerende sessie telt ook als "ooit ingelogd": markeer
                // het toestel zodat een latere logout op inloggen landt.
                await this.markAuthenticated();
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
            this.awaitingConnection = false;
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
            this.awaitingConnection = false;
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
            // Een 401 (of logout) is een definitieve auth-uitkomst, geen
            // verbindingsprobleem: nooit in reconnect-stand blijven hangen.
            this.awaitingConnection = false;

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
