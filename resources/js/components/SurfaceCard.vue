<script setup lang="ts">
import { computed } from 'vue';

type Tone = 'default' | 'muted' | 'subtle';

const props = withDefaults(
    defineProps<{
        tone?: Tone;
        padded?: boolean;
    }>(),
    {
        tone: 'default',
        padded: true,
    },
);

const toneClasses = computed(() => {
    const map: Record<Tone, string> = {
        default: 'bg-surface/70',
        muted: 'bg-surface/50',
        subtle: 'bg-surface/20',
    };

    return map[props.tone];
});
</script>

<template>
    <div
        class="rounded-lg shadow-sm backdrop-blur-sm"
        :class="[toneClasses, padded ? 'p-5' : '']"
    >
        <slot />
    </div>
</template>
