<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
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
import { bottomNavVisibleFor } from '@/spa/composables/useBottomNav';
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

// De overlay schuift van onder in beeld en weer weg; de achtergrond blijft staan.
const postOverlayTransition = {
    enterActiveClass: 'transition-transform duration-300 ease-out',
    enterFromClass: 'translate-y-full',
    enterToClass: 'translate-y-0',
    leaveActiveClass: 'transition-transform duration-200 ease-in',
    leaveFromClass: 'translate-y-0',
    leaveToClass: 'translate-y-full',
};

// The custom bottom nav lives at the root so it persists across route
// transitions instead of remounting (and flickering) per page.
const showBottomNav = computed(() => bottomNavVisibleFor(route, auth.user));

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
});

// Onboarding-stappen krijgen een richting-bewuste slide + fade; alle overige
// routes behouden de bestaande, neutrale opacity-fade.
const routeTransition = computed(() => {
    if (!isOnboardingRoute.value) {
        return {
            enterActiveClass: 'transition duration-150 ease-out',
            enterFromClass: 'opacity-0',
            enterToClass: 'opacity-100',
            leaveActiveClass: 'transition duration-100 ease-in',
            leaveFromClass: 'opacity-100',
            leaveToClass: 'opacity-0',
        };
    }

    const forward = onboardingDirection.value === 'forward';

    return {
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

    <!-- overflow-x-clip vangt de horizontale slide op zonder een scrollbar of
 een nieuwe scroll-container te maken (clip dwingt de andere as niet naar auto). -->
    <div class="overflow-x-clip">
        <RouterView v-slot="{ Component }" :route="postBackgroundRoute">
            <Transition mode="out-in" v-bind="routeTransition">
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
