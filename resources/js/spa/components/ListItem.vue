<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';

withDefaults(
    defineProps<{
        to?: RouteLocationRaw | null;
        showChevron?: boolean;
    }>(),
    {
        to: null,
        showChevron: true,
    },
);

defineEmits<{
    (e: 'click'): void;
}>();
</script>

<template>
    <component
        :is="to ? RouterLink : 'button'"
        :to="to ?? undefined"
        :type="to ? undefined : 'button'"
        class="flex w-full items-center gap-4 bg-white/70 px-4 py-4 text-left backdrop-blur-sm transition hover:bg-white active:scale-[0.99]"
        @click="$emit('click')"
    >
        <slot name="leading" />
        <div class="min-w-0 flex-1">
            <p class="truncate font-sans text-base font-semibold text-teal">
                <slot />
            </p>
            <p v-if="$slots.subtitle" class="truncate text-teal-muted">
                <slot name="subtitle" />
            </p>
        </div>
        <slot name="trailing">
            <svg
                v-if="showChevron"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="size-5 text-teal-muted/60"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
            </svg>
        </slot>
    </component>
</template>
