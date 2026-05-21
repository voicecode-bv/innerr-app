<script setup lang="ts">
import { computed } from 'vue';

type Size = 'xs' | 'sm' | 'md' | 'lg';
type Tone = 'sage' | 'sand' | 'accent' | 'teal' | 'orange' | 'green' | 'yellow';

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
        xs: 'size-8',
        sm: 'size-10',
        md: 'size-12',
        lg: 'size-14',
    };
    const toneMap: Record<Tone, string> = {
        sage: 'bg-sand-100 dark:bg-brand-blue/50 text-ink',
        sand: 'bg-sand-100 text-ink',
        accent: 'bg-accent-soft/30 text-accent',
        teal: 'bg-action text-brand-sand',
        orange: 'bg-brand-orange text-brand-sand',
        green: 'bg-brand-green text-brand-sand',
        yellow: 'bg-brand-yellow text-brand-blue',
    };

    return [sizeMap[props.size], toneMap[props.tone]];
});

const iconSizeClass = computed(() => {
    const map: Record<Size, string> = {
        xs: 'size-4',
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
