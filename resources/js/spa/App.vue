<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { usePushNotifications } from '@/composables/usePushNotifications';
import BottomNav from '@/spa/components/BottomNav.vue';
import FeatureTourMount from '@/spa/components/FeatureTourMount.vue';
import ReconnectOverlay from '@/spa/components/ReconnectOverlay.vue';
import {
    backgroundPathOnOverlayEnter,
    isPostDetailRoute,
} from '@/spa/composables/postDetailOverlay';
import {
    acquireBackgroundScale,
    backgroundScaled,
    releaseBackgroundScale,
} from '@/spa/composables/useBackgroundScale';
import { bottomNavVisibleFor } from '@/spa/composables/useBottomNav';
import { useEdgeSwipeBack } from '@/spa/composables/useEdgeSwipeBack';
import {
    lastTransitionKind,
    navTracker,
    suppressNextTransition,
    transitionKindFor,
} from '@/spa/composables/useNavDirection';
import { prefersReducedMotion } from '@/spa/services/motion';
import { overlayTransitionSuppressed } from '@/spa/services/postHeroTransition';
import { useAuthStore } from '@/spa/stores/auth';

useNetworkStatus();
usePushNotifications();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const isGuestRoute = computed(() => route.meta.guest === true);

// De post-detailpagina rendert als een overlay bovenop de achtergrondpagina.
// We laden hem lazy (zelfde chunk als de route) zodat de initiële bundel klein
// blijft; bij het openen van een post heeft de router de chunk al opgehaald.
const PostDetail = defineAsyncComponent(
    () => import('@/spa/pages/PostDetail.vue'),
);

// De locatie die áchter de overlay zichtbaar blijft. Onthouden zodra we de
// overlay openen, zodat de feed (of welke pagina dan ook) gemount blijft en zijn
// scroll-positie behoudt. Bij een directe deeplink is dit `null` → val terug op
// de feed.
const postBackgroundPath = ref<string | null>(null);

router.beforeEach((to, from) => {
    const next = backgroundPathOnOverlayEnter(to, from);

    if (next !== undefined) {
        postBackgroundPath.value = next;
    }
});

const isPostOverlayOpen = computed(() => isPostDetailRoute(route));

// The post detail overlay participates in the iOS card-stack effect: the
// background page scales down behind it while it is open.
watch(isPostOverlayOpen, (open) => {
    if (open) {
        acquireBackgroundScale();
    } else {
        releaseBackgroundScale();
    }
});

// Zolang de overlay open is, dwingen we de hoofd-RouterView om de
// achtergrondlocatie te renderen i.p.v. de actieve (post-)route. Daardoor blijft
// de achtergrond exact zoals hij was; de overlay zelf rendert los hieronder.
const postBackgroundRoute = computed<RouteLocationNormalizedLoaded | undefined>(
    () =>
        isPostOverlayOpen.value
            ? // `resolve()` levert een RouteLocationResolved; RouterView's `route`
              // verwacht een genormaliseerde loaded-locatie. Runtime-compatibel,
              // dus we casten het verschil in de `matched`-array weg.
              (router.resolve(
                  postBackgroundPath.value ?? '/',
              ) as unknown as RouteLocationNormalizedLoaded)
            : undefined,
);

// The overlay slides in from the bottom and back out; the background stays
// put. When a View Transitions hero morph drives the open/close instead, the
// slide is suppressed so the two animations don't fight.
const postOverlayTransition = computed(() =>
    overlayTransitionSuppressed.value
        ? {}
        : {
              enterActiveClass:
                  'transition-transform duration-300 ease-spring-soft',
              enterFromClass: 'translate-y-full',
              enterToClass: 'translate-y-0',
              leaveActiveClass: 'transition-transform duration-200 ease-in',
              leaveFromClass: 'translate-y-0',
              leaveToClass: 'translate-y-full',
          },
);

// The custom bottom nav lives at the root so it persists across route
// transitions instead of remounting (and flickering) per page.
const showBottomNav = computed(() => bottomNavVisibleFor(route, auth.user));

// iOS edge-swipe back: drags the whole route container with the finger on
// stacked views (memory history loses the native back gesture).
const routeContainerRef = ref<HTMLElement | null>(null);
useEdgeSwipeBack(routeContainerRef);

// Volgorde van de onboarding-stappen, gebruikt om de slide-richting te bepalen:
// naar een latere stap schuift van rechts in, terug van links.
const ONBOARDING_ORDER = [
    'spa.onboarding.intro',
    'spa.onboarding.circle-permissions',
    'spa.onboarding.invite-members',
    'spa.onboarding.notifications',
];

const isOnboardingRoute = computed(
    () =>
        typeof route.name === 'string' &&
        route.name.startsWith('spa.onboarding.'),
);

const onboardingDirection = ref<'forward' | 'back'>('forward');

router.afterEach((to, from) => {
    const toIndex = ONBOARDING_ORDER.indexOf(String(to.name));
    const fromIndex = ONBOARDING_ORDER.indexOf(String(from.name));

    onboardingDirection.value =
        toIndex !== -1 && fromIndex !== -1 && toIndex < fromIndex
            ? 'back'
            : 'forward';

    // Direction-aware transition for all other routes: push (into the
    // hierarchy), pop (back up) or fade (lateral tab switch). The navTracker
    // recognizes explicit back navigations the depth heuristic would miss.
    const wentBack = navTracker.record(to.path);

    // The edge-swipe back gesture already animated the page off-screen; the
    // route swap itself must be instant for that one navigation.
    if (suppressNextTransition.value) {
        suppressNextTransition.value = false;
        lastTransitionKind.value = 'none';

        return;
    }

    lastTransitionKind.value = transitionKindFor(to.path, from.path, wentBack);
});

// Neutral cross-fade, used for lateral tab switches, reduced motion, and as
// the safe default.
const FADE_TRANSITION = {
    mode: 'out-in' as const,
    enterActiveClass: 'transition duration-150 ease-out',
    enterFromClass: 'opacity-0',
    enterToClass: 'opacity-100',
    leaveActiveClass: 'transition duration-100 ease-in',
    leaveFromClass: 'opacity-100',
    leaveToClass: 'opacity-0',
};

// iOS-style push/pop: both views move simultaneously. The leaving view is
// lifted out of flow (absolute) so the entering view can take its place; the
// view "underneath" parallaxes at one third speed and dims slightly. The
// entering view is `relative` so its z-index competes with the absolutely
// positioned leaving view.
const PUSH_TRANSITION = {
    enterActiveClass:
        'relative z-10 transition-[translate,filter] duration-300 ease-spring-soft',
    enterFromClass: 'translate-x-full',
    enterToClass: 'translate-x-0',
    leaveActiveClass:
        'absolute inset-0 z-0 transition-[translate,filter] duration-300 ease-spring-soft',
    leaveFromClass: 'translate-x-0 brightness-100',
    leaveToClass: '-translate-x-1/3 brightness-90',
};

const POP_TRANSITION = {
    enterActiveClass:
        'relative z-0 transition-[translate,filter] duration-300 ease-spring-soft',
    enterFromClass: '-translate-x-1/3 brightness-90',
    enterToClass: 'translate-x-0 brightness-100',
    leaveActiveClass:
        'absolute inset-0 z-10 transition-transform duration-300 ease-spring-soft',
    leaveFromClass: 'translate-x-0',
    leaveToClass: 'translate-x-full',
};

// Onboarding keeps its own sequential slide; main routes get direction-aware
// push/pop with a parallaxing under-view, falling back to the neutral fade
// for lateral tab switches and reduced motion.
const routeTransition = computed(() => {
    if (isOnboardingRoute.value) {
        const forward = onboardingDirection.value === 'forward';

        return {
            mode: 'out-in' as const,
            enterActiveClass: 'transition duration-200 ease-out',
            enterFromClass: forward
                ? 'opacity-0 translate-x-6'
                : 'opacity-0 -translate-x-6',
            enterToClass: 'opacity-100 translate-x-0',
            leaveActiveClass: 'transition duration-200 ease-in',
            leaveFromClass: 'opacity-100 translate-x-0',
            leaveToClass: forward
                ? 'opacity-0 -translate-x-6'
                : 'opacity-0 translate-x-6',
        };
    }

    if (lastTransitionKind.value === 'none') {
        return {};
    }

    if (prefersReducedMotion() || lastTransitionKind.value === 'fade') {
        return FADE_TRANSITION;
    }

    return lastTransitionKind.value === 'pop'
        ? POP_TRANSITION
        : PUSH_TRANSITION;
});
// Feature-tour pas mounten als de gebruiker is ingelogd én voorbij de
// onboarding. Anders zou de tour kunnen proberen te starten op een lazy
// onboarding-route waar de bijbehorende selectors niet bestaan.
const showFeatureTour = computed(
    () =>
        auth.user !== null &&
        auth.user.onboarded === true &&
        // Don't start the tour while the email-verification gate is still active.
        !(auth.user.email_verification_required && !auth.user.email_verified),
);
</script>

<template>
    <!-- Persistente achtergrond zodat er nooit een wit/leeg-frame zichtbaar is
 tijdens route-transities of het laden van een lazy chunk. -->
    <div
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 -z-20 bg-sand"
    />
    <div
        v-if="isGuestRoute"
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 -z-10 bg-brand-blue"
    />

    <!-- overflow-x-clip catches the horizontal slide without creating a
 scrollbar or a new scroll container (clip does not force the other axis to
 auto). `relative` sizes the absolutely positioned leave-view used by the
 push/pop transitions. -->
    <!-- iOS card-stack: while a sheet/overlay is open the page scales down
 slightly. The transform also reparents the fixed headers inside, so they
 scale along with the page as one card. -->
    <div
        ref="routeContainerRef"
        class="relative overflow-x-clip transition-[transform,scale,filter,border-radius] duration-300 ease-spring-soft"
        :class="
            backgroundScaled
                ? 'scale-[0.96] overflow-hidden rounded-2xl brightness-90'
                : ''
        "
    >
        <RouterView v-slot="{ Component }" :route="postBackgroundRoute">
            <Transition v-bind="routeTransition">
                <component :is="Component" />
            </Transition>
        </RouterView>
    </div>

    <!-- Post-detail als full-screen overlay bovenop de achtergrondpagina. Nog
 steeds een echte route (URL/back-knop/deeplinks blijven werken), maar de feed
 eronder blijft gemount i.p.v. weg te navigeren. -->
    <Transition v-bind="postOverlayTransition">
        <PostDetail v-if="isPostOverlayOpen" />
    </Transition>

    <BottomNav v-if="showBottomNav" />

    <FeatureTourMount v-if="showFeatureTour" />

    <!-- Reconnect-scherm: getoond wanneer we een geldig token vasthouden maar de
 sessie nog niet bevestigd kon worden (externe API onbereikbaar). Dekt alles af
 en probeert het zelf opnieuw, i.p.v. de gebruiker naar login te sturen. -->
    <ReconnectOverlay v-if="auth.awaitingConnection && !auth.user" />
</template>
