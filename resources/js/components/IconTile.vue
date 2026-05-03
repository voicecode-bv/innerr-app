<script setup lang="ts">
import { computed } from 'vue';

type Size = 'sm' | 'md' | 'lg';
type Tone = 'sage' | 'sand' | 'accent' | 'teal';

const props = withDefaults(
    defineProps<{
        icon: string;
        size?: Size;
        tone?: Tone;
    }>(),
    {
        size: 'md',
        tone: 'sage',
    },
);

const wrapperClasses = computed(() => {
    const sizeMap: Record<Size, string> = {
        sm: 'size-10',
        md: 'size-12',
        lg: 'size-14',
    };
    const toneMap: Record<Tone, string> = {
        sage: 'bg-sage-100 text-teal dark:bg-sage-900/40 dark:text-sage-100',
        sand: 'bg-sand-100 text-sand-600 dark:bg-sand-700/60 dark:text-sand-300',
        accent: 'bg-accent-soft/30 text-accent dark:bg-accent/20 dark:text-accent-soft',
        teal: 'bg-teal text-white',
    };
    return [sizeMap[props.size], toneMap[props.tone]];
});

const iconSizeClass = computed(() => {
    const map: Record<Size, string> = {
        sm: 'size-5',
        md: 'size-7',
        lg: 'size-8',
    };
    return map[props.size];
});

const maskStyle = computed(() => ({
    maskImage: `url(${props.icon})`,
    WebkitMaskImage: `url(${props.icon})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
}));
</script>

<template>
    <span
        class="flex shrink-0 items-center justify-center rounded-lg"
        :class="wrapperClasses"
    >
        <span
            aria-hidden="true"
            class="inline-block bg-current"
            :class="iconSizeClass"
            :style="maskStyle"
        ></span>
    </span>
</template>
