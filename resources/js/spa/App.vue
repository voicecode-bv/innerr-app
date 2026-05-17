<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { usePushNotifications } from '@/composables/usePushNotifications';
import FeatureTourMount from '@/spa/components/FeatureTourMount.vue';
import { useAuthStore } from '@/spa/stores/auth';

useNetworkStatus();
usePushNotifications();

const route = useRoute();
const auth = useAuthStore();
const isGuestRoute = computed(() => route.meta.guest === true);
// Feature-tour pas mounten als de gebruiker is ingelogd én voorbij de
// onboarding. Anders zou de tour kunnen proberen te starten op een lazy
// onboarding-route waar de bijbehorende selectors niet bestaan.
const showFeatureTour = computed(
    () => auth.user !== null && auth.user.onboarded === true,
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

    <RouterView v-slot="{ Component }">
        <Transition
            mode="out-in"
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <component :is="Component" />
        </Transition>
    </RouterView>

    <FeatureTourMount v-if="showFeatureTour" />
</template>
