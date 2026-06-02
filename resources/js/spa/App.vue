<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { usePushNotifications } from '@/composables/usePushNotifications';
import FeatureTourMount from '@/spa/components/FeatureTourMount.vue';
import { useAuthStore } from '@/spa/stores/auth';

useNetworkStatus();
usePushNotifications();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const isGuestRoute = computed(() => route.meta.guest === true);

// Volgorde van de onboarding-stappen, gebruikt om de slide-richting te bepalen:
// naar een latere stap schuift van rechts in, terug van links. De first-circle
// → notifications "skip" telt als vooruit omdat notifications later staat.
const ONBOARDING_ORDER = [
    'spa.onboarding.intro',
    'spa.onboarding.birthdate',
    'spa.onboarding.first-circle',
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
        <RouterView v-slot="{ Component }">
            <Transition mode="out-in" v-bind="routeTransition">
                <component :is="Component" />
            </Transition>
        </RouterView>
    </div>

    <FeatureTourMount v-if="showFeatureTour" />
</template>
