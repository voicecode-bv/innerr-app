<script setup lang="ts">
import { ref, watch } from 'vue';
import { rollDirection } from '@/spa/services/motion';

/**
 * Rolling counter: when the value changes, the old value slides out and the
 * new one slides in vertically (up for increases, down for decreases) instead
 * of the text snapping. Renders as a single inline element; sizing follows
 * the widest of the two values during the roll.
 */
const props = defineProps<{
    value: number | string;
}>();

const direction = ref<'up' | 'down'>('up');

watch(
    () => props.value,
    (next, previous) => {
        direction.value = rollDirection(next, previous);
    },
);
</script>

<template>
    <span class="inline-grid overflow-hidden">
        <Transition
            :enter-from-class="
                direction === 'up'
                    ? 'translate-y-full opacity-0'
                    : '-translate-y-full opacity-0'
            "
            enter-active-class="transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none"
            enter-to-class="translate-y-0 opacity-100"
            leave-from-class="translate-y-0 opacity-100"
            leave-active-class="transition-[translate,opacity] duration-200 ease-in motion-reduce:transition-none"
            :leave-to-class="
                direction === 'up'
                    ? '-translate-y-full opacity-0'
                    : 'translate-y-full opacity-0'
            "
        >
            <span :key="String(value)" class="[grid-area:1/1]">{{
                value
            }}</span>
        </Transition>
    </span>
</template>
