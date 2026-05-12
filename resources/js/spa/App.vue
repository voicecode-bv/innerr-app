<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useNetworkStatus } from '@/composables/useNetworkStatus';

useNetworkStatus();

const route = useRoute();
const isGuestRoute = computed(() => route.meta.guest === true);
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
</template>
