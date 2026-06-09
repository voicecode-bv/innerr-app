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
        // True wanneer we een token vasthouden maar de bootstrap de gebruiker
        // niet kon bevestigen omdat de externe API onbereikbaar was. De app
        // toont dan het reconnect-scherm i.p.v. de gebruiker naar login te
        // sturen; een geldig token leidt nooit tot een gedwongen re-login.
        awaitingConnection: false,
        // True wanneer de Keychain-bridge bij een cold-start geen definitief
        // antwoord gaf: er kan een geldig token bestaan dat we (nog) niet konden
        // lezen. We behandelen dit NOOIT als "uitgelogd" maar tonen het
        // reconnect-scherm, dat de Keychain-lees opnieuw probeert.
        storageUnavailable: false,
    }),
    actions: {
        // Leest het token uit de Keychain en zet `storageUnavailable` als de
        // bridge geen definitief antwoord gaf. Wordt vroeg in `main.ts`
        // aangeroepen (vóór de BFF bootstrap) en opnieuw door het reconnect-
        // scherm, zodat een aanvankelijk mislukte lees alsnog kan herstellen
        // i.p.v. de gebruiker uit te loggen.
        async restoreFromStorage(): Promise<void> {
            this.storageUnavailable = false;
            await this.restoreToken();
        },
        // Wordt vroeg aangeroepen zodat externalApi al een Bearer kan sturen
        // tijdens cold-start. Een onleesbare bridge zet `storageUnavailable`
        // i.p.v. het token als afwezig te behandelen.
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

                // Konden we de Keychain niet lezen, dan is deze "unauthenticated"
                // niet te vertrouwen: er ging geen Bearer mee. Blijf in reconnect-
                // stand zodat het overlay de Keychain-lees blijft proberen i.p.v.
                // de gebruiker naar welkom/login te sturen.
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
            // verbindings- of opslagprobleem: nooit in reconnect-stand blijven
            // hangen.
            this.awaitingConnection = false;
            this.storageUnavailable = false;

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
