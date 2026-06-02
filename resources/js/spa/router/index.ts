import { Edge } from '@nativephp/mobile';
import {
    createRouter,
    createWebHistory,
    createMemoryHistory,
} from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { isNativeRuntime, usePlatform } from '@/spa/composables/usePlatform';
import { api } from '@/spa/http/apiClient';
import { useAuthStore } from '@/spa/stores/auth';
import { useFeatureTourStore } from '@/spa/stores/featureTour';

declare module 'vue-router' {
    interface RouteMeta {
        auth?: boolean;
        guest?: boolean;
        onboarded?: boolean;
        iosOnly?: boolean;
        mobileOnly?: boolean;
        public?: boolean;
        hideEdgeBar?: boolean;
    }
}

const isNative = isNativeRuntime();
const isLocalEnv =
    (import.meta.env.VITE_APP_ENV ?? 'production') !== 'production';

const routes: RouteRecordRaw[] = [
    // Auth (guest-only)
    {
        path: '/login',
        name: 'spa.login',
        component: () => import('@/spa/pages/Auth/Login.vue'),
        meta: { guest: true },
    },
    {
        path: '/register',
        name: 'spa.register',
        component: () => import('@/spa/pages/Auth/Register.vue'),
        meta: { guest: true },
    },
    {
        path: '/forgot-password',
        name: 'spa.forgot-password',
        component: () => import('@/spa/pages/Auth/ForgotPassword.vue'),
        meta: { guest: true },
    },
    {
        path: '/password-reset',
        name: 'spa.password-reset',
        component: () => import('@/spa/pages/Auth/ResetPassword.vue'),
        meta: { guest: true },
    },
    {
        path: '/oauth-callback',
        name: 'spa.oauth-callback',
        alias: '/oauth/callback',
        component: () => import('@/spa/pages/Auth/OAuthCallback.vue'),
    },

    // Invite landing (public — guest en ingelogd mogen erbij)
    {
        path: '/invite/:token',
        alias: '/join/:token',
        name: 'spa.invite.show',
        component: () => import('@/spa/pages/InviteLanding.vue'),
        meta: { public: true },
    },

    // Onboarding (auth, no onboarded check)
    {
        path: '/onboarding/intro',
        name: 'spa.onboarding.intro',
        component: () => import('@/spa/pages/Onboarding/Intro.vue'),
        meta: { auth: true },
    },
    {
        path: '/onboarding/birthdate',
        name: 'spa.onboarding.birthdate',
        component: () => import('@/spa/pages/Onboarding/BirthDate.vue'),
        meta: { auth: true },
    },
    {
        path: '/onboarding/first-circle',
        name: 'spa.onboarding.first-circle',
        component: () => import('@/spa/pages/Onboarding/FirstCircle.vue'),
        meta: { auth: true },
    },
    {
        path: '/onboarding/circles/:circle/permissions',
        name: 'spa.onboarding.circle-permissions',
        component: () => import('@/spa/pages/Onboarding/CirclePermissions.vue'),
        meta: { auth: true },
    },
    {
        path: '/onboarding/circles/:circle/invite',
        name: 'spa.onboarding.invite-members',
        component: () => import('@/spa/pages/Onboarding/InviteMembers.vue'),
        meta: { auth: true },
    },
    {
        path: '/onboarding/notifications',
        name: 'spa.onboarding.notifications',
        component: () => import('@/spa/pages/Onboarding/Notifications.vue'),
        meta: { auth: true },
    },

    // Main app (auth + onboarded)
    {
        path: '/',
        name: 'spa.home',
        component: () => import('@/spa/pages/Feed.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/feed/grid',
        name: 'spa.home.grid',
        component: () => import('@/spa/pages/FeedGrid.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/circles/:circle/feed',
        name: 'spa.circles.feed',
        component: () => import('@/spa/pages/CircleFeed.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/posts/create',
        name: 'spa.posts.create',
        component: () => import('@/spa/pages/CreatePost.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/quotes/create',
        name: 'spa.quotes.create',
        component: () => import('@/spa/pages/CreateQuote.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/posts/:post',
        name: 'spa.posts.show',
        component: () => import('@/spa/pages/PostDetail.vue'),
        meta: { auth: true, onboarded: true },
    },

    // Feed filter (guided flow) — verbergt de native bottom-nav.
    {
        path: '/feed/filter',
        name: 'spa.feed-filter',
        component: () => import('@/spa/pages/FeedFilter/Wizard.vue'),
        meta: { auth: true, onboarded: true, hideEdgeBar: true },
    },
    {
        path: '/feed/filter/results',
        name: 'spa.feed-filter.results',
        component: () => import('@/spa/pages/FeedFilter/Results.vue'),
        meta: { auth: true, onboarded: true, hideEdgeBar: true },
    },

    // Notifications
    {
        path: '/notifications',
        name: 'spa.notifications',
        component: () => import('@/spa/pages/Notifications.vue'),
        meta: { auth: true, onboarded: true },
    },

    // Search
    {
        path: '/search',
        name: 'spa.search',
        component: () => import('@/spa/pages/Search.vue'),
        meta: { auth: true, onboarded: true },
    },

    // Map
    {
        path: '/map',
        name: 'spa.map',
        component: () => import('@/spa/pages/Map.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/profiles/:username/map',
        name: 'spa.profiles.map',
        component: () => import('@/spa/pages/ProfileMap.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/circles/:circle/map',
        name: 'spa.circles.map',
        component: () => import('@/spa/pages/CircleMap.vue'),
        meta: { auth: true, onboarded: true },
    },

    // Profile
    {
        path: '/profiles/:username',
        name: 'spa.profiles.show',
        component: () => import('@/spa/pages/Profile.vue'),
        meta: { auth: true, onboarded: true },
    },

    // Circles
    {
        path: '/circles',
        name: 'spa.circles.index',
        component: () => import('@/spa/pages/Circles/Index.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/circles/:circle',
        name: 'spa.circles.show',
        component: () => import('@/spa/pages/Circles/Show.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/circles/:circle/transfer-ownership',
        name: 'spa.circles.transfer-ownership',
        component: () => import('@/spa/pages/Circles/TransferOwnership.vue'),
        meta: { auth: true, onboarded: true },
    },

    // Settings
    {
        path: '/settings',
        name: 'spa.settings',
        component: () => import('@/spa/pages/Settings/Index.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/account',
        name: 'spa.settings.account',
        component: () => import('@/spa/pages/Settings/Account.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/edit-profile',
        name: 'spa.settings.edit-profile',
        component: () => import('@/spa/pages/Settings/EditProfile.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/tags',
        name: 'spa.settings.tags',
        component: () => import('@/spa/pages/Settings/Tags.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/persons',
        name: 'spa.settings.persons',
        component: () => import('@/spa/pages/Settings/Persons.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/notifications',
        name: 'spa.settings.notifications',
        component: () =>
            import('@/spa/pages/Settings/NotificationPreferences.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/default-circles',
        name: 'spa.settings.default-circles',
        component: () => import('@/spa/pages/Settings/DefaultCircles.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/give',
        name: 'spa.settings.give',
        component: () => import('@/spa/pages/Settings/Give.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/storage',
        name: 'spa.settings.storage',
        component: () => import('@/spa/pages/Settings/Storage.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/subscriptions',
        name: 'spa.settings.subscriptions',
        component: () => import('@/spa/pages/Settings/Subscriptions.vue'),
        meta: { auth: true, onboarded: true, mobileOnly: true },
    },

    // Dev tools — only registered outside production (e.g. the debug page).
    ...(isLocalEnv
        ? [
              {
                  path: '/dev/debug',
                  name: 'spa.dev.debug',
                  component: () => import('@/spa/pages/Dev/Debug.vue'),
                  meta: { auth: true, onboarded: true },
              } as RouteRecordRaw,
          ]
        : []),

    // Catch-all → login
    {
        path: '/:pathMatch(.*)*',
        redirect: { name: 'spa.login' },
    },
];

export const router = createRouter({
    history: isNative ? createMemoryHistory() : createWebHistory(),
    routes,
});

router.beforeEach(async (to) => {
    const auth = useAuthStore();

    if (to.meta.public) {
        // Public routes (zoals invite landing) zijn voor zowel guests als ingelogde users.
        return;
    }

    if (to.meta.auth && !auth.user) {
        return { name: 'spa.login' };
    }

    if (to.meta.guest && auth.user) {
        return { name: 'spa.home' };
    }

    if (to.meta.onboarded && auth.user && !auth.user.onboarded) {
        return { name: 'spa.onboarding.intro' };
    }

    // Home honours the user's preferred feed layout. Masonry (including the
    // not-yet-chosen default) renders the grid feed; the bottom-nav Home button
    // targets '/' either way and lands on the right view via this redirect.
    //
    // Suppressed while the onboarding feature tour is running: its feed segment
    // targets 'spa.home' (the list feed), and redirecting that to the grid would
    // make FeatureTourMount push 'spa.home' again on every route change — an
    // endless redirect loop.
    if (
        to.name === 'spa.home' &&
        auth.user &&
        useFeatureTourStore().status !== 'running' &&
        (auth.user.feed_layout ?? 'masonry') === 'masonry'
    ) {
        return { name: 'spa.home.grid' };
    }

    if (to.meta.iosOnly) {
        const { isIos, ensureDetected } = usePlatform();
        await ensureDetected();

        if (!isIos.value) {
            return { name: 'spa.settings' };
        }
    }

    if (to.meta.mobileOnly) {
        const { isIos, isAndroid, ensureDetected } = usePlatform();
        await ensureDetected();

        if (!isIos.value && !isAndroid.value) {
            return { name: 'spa.settings' };
        }
    }
});

router.afterEach((to) => {
    const auth = useAuthStore();

    if (!auth.user) {
        return;
    }

    if (to.meta.hideEdgeBar) {
        // Routes die de native bottom-nav verbergen (bv. de feed-filter flow):
        // sla de active-tab POST over die hem juist zou herstellen, en wis hem
        // synchroon zodat hij niet kort oplicht tijdens het navigeren tussen
        // stappen. clearSync is een no-op op non-native clients.
        try {
            Edge.clearSync();
        } catch {
            // Niet-native context (browser preview): geen edge-bar om te wissen.
        }

        return;
    }

    api.post('/api/spa/edge/active-tab', { path: to.path }).catch(() => {
        // Fire-and-forget; native bottom-nav blijft zoals het was bij netwerkfouten.
        // Edge::set() is een no-op op non-native clients dus altijd veilig om aan te roepen.
    });
});
