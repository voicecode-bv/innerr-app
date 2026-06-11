import {
    createRouter,
    createWebHistory,
    createMemoryHistory,
} from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { usePlatform } from '@/spa/composables/usePlatform';
import {
    firstOwnedCircleId,
    onboardingResumeNeedsCircle,
    onboardingResumeRoute,
} from '@/spa/router/onboardingResume';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
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

// iOS serves the WebView over the custom `php://` scheme, where the HTML5
// History API (pushState/replaceState) is unreliable, so it stays on in-memory
// history and leans on in-app back buttons / edge-swipe. Android serves over
// `http://127.0.0.1` and web runs on a real domain — both fully support the
// History API. Using web history there means SPA navigations push real
// `window.history` entries, so the Android hardware back button (which checks
// `WebView.canGoBack()` and calls `goBack()`) walks back through the SPA
// instead of finishing the activity and closing the app.
const useMemoryHistory =
    typeof window !== 'undefined' && window.location.protocol === 'php:';

// Guest landing: every unauthenticated visitor lands on the welcome chooser,
// including users who just logged out. Keep this in sync with the guard below
// and the catch-all redirect.
function guestLanding(): { name: string } {
    return { name: 'spa.welcome' };
}

const routes: RouteRecordRaw[] = [
    // Auth (guest-only)
    {
        path: '/welcome',
        name: 'spa.welcome',
        component: () => import('@/spa/pages/Auth/Welcome.vue'),
        meta: { guest: true },
    },
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

    // Email verification gate (auth, no onboarded check) — reachable during the
    // post-signup funnel, before the main app unlocks.
    {
        path: '/verify-email',
        name: 'spa.verify-email',
        component: () => import('@/spa/pages/Auth/VerifyEmail.vue'),
        meta: { auth: true },
    },

    // Onboarding (auth, no onboarded check)
    {
        path: '/onboarding/intro',
        name: 'spa.onboarding.intro',
        component: () => import('@/spa/pages/Onboarding/Intro.vue'),
        meta: { auth: true },
    },
    {
        path: '/onboarding/circles/:circle/children',
        name: 'spa.onboarding.add-children',
        component: () => import('@/spa/pages/Onboarding/AddChildren.vue'),
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
        // De detailpagina is een full-screen overlay; de bottom-nav hoort er
        // niet onder door te schijnen.
        meta: { auth: true, onboarded: true, hideEdgeBar: true },
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

    // Timeline of a tagged person (e.g. a child), sorted by taken_at
    {
        path: '/timeline/:person',
        name: 'spa.timeline',
        component: () => import('@/spa/pages/Timeline.vue'),
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
        path: '/settings/account',
        name: 'spa.settings.account',
        component: () => import('@/spa/pages/Settings/Account.vue'),
        meta: { auth: true, onboarded: true },
    },
    {
        path: '/settings/support',
        name: 'spa.settings.support',
        component: () => import('@/spa/pages/Settings/Support.vue'),
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

    // Debug page — publicly reachable (no auth/onboarded gate) via the hidden
    // 10-tap gesture on the login logo. Kept public on purpose so it can be used
    // to diagnose token / secure-storage issues even when the user appears to be
    // logged out.
    {
        path: '/dev/debug',
        name: 'spa.dev.debug',
        component: () => import('@/spa/pages/Dev/Debug.vue'),
        meta: { public: true },
    },

    // Catch-all → welcome
    {
        path: '/:pathMatch(.*)*',
        redirect: () => guestLanding(),
    },
];

export const router = createRouter({
    history: useMemoryHistory ? createMemoryHistory() : createWebHistory(),
    routes,
});

router.beforeEach(async (to) => {
    const auth = useAuthStore();

    if (to.meta.public) {
        // Public routes (zoals invite landing) zijn voor zowel guests als ingelogde users.
        return;
    }

    if (to.meta.auth && !auth.user) {
        // Bij `awaitingConnection` (token aanwezig maar API onbereikbaar) landen
        // we ook hier: we navigeren gewoon naar login/welkom, maar de
        // ReconnectOverlay in App.vue dekt dat scherm volledig af en probeert het
        // opnieuw. We aborten de navigatie bewust NIET — dat zou de initiële
        // router-navigatie laten hangen en de splash nooit laten verdwijnen.
        return guestLanding();
    }

    if (to.meta.guest && auth.user) {
        return { name: 'spa.home' };
    }

    // Email verification gate, checked BEFORE the onboarding resume so a fresh
    // account follows register → verify → onboard and never hits the verify
    // screen as a surprise after finishing the onboarding. Covers both the
    // main app and the onboarding routes; grandfathered accounts have
    // email_verification_required === false and pass straight through.
    if (
        auth.user &&
        auth.user.email_verification_required &&
        !auth.user.email_verified &&
        (to.meta.onboarded === true ||
            String(to.name ?? '').startsWith('spa.onboarding.'))
    ) {
        return { name: 'spa.verify-email' };
    }

    if (to.meta.onboarded && auth.user && !auth.user.onboarded) {
        // Resume at the step AFTER the furthest one the user completed (the
        // API reports it in the bootstrap payload) instead of restarting the
        // whole flow at the intro. Steps that live under a circle need the
        // family circle id; when that cannot be resolved we fall back to the
        // intro, which re-resolves it on continue.
        const step = auth.user.onboarding_step;

        if (!onboardingResumeNeedsCircle(step)) {
            return onboardingResumeRoute(step, null);
        }

        try {
            const circles = await useCirclesStore().ensureLoaded();

            return onboardingResumeRoute(step, firstOwnedCircleId(circles));
        } catch {
            return { name: 'spa.onboarding.intro' };
        }
    }

    // Keep users who don't need the verification screen out of it.
    if (
        to.name === 'spa.verify-email' &&
        auth.user &&
        (!auth.user.email_verification_required || auth.user.email_verified)
    ) {
        return { name: 'spa.home' };
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
            return { name: 'spa.home' };
        }
    }

    if (to.meta.mobileOnly) {
        const { isIos, isAndroid, ensureDetected } = usePlatform();
        await ensureDetected();

        if (!isIos.value && !isAndroid.value) {
            return { name: 'spa.home' };
        }
    }
});
