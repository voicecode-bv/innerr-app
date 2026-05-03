<script setup lang="ts">
import { computed } from 'vue';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const props = withDefaults(
    defineProps<{
        variant?: Variant;
        size?: Size;
        type?: 'button' | 'submit' | 'reset';
        disabled?: boolean;
        block?: boolean;
    }>(),
    {
        variant: 'primary',
        size: 'md',
        type: 'button',
        disabled: false,
        block: false,
    },
);

const base =
    'inline-flex items-center justify-center gap-2 rounded-lg whitespace-nowrap transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40';

const variants: Record<Variant, string> = {
    primary: 'bg-teal text-white hover:bg-teal-light shadow-sm',
    secondary: 'bg-cream text-teal border border-teal/20 hover:bg-warmwhite',
    ghost: 'bg-transparent text-teal hover:bg-teal/5',
    danger: 'bg-white text-accent border border-accent/30 hover:bg-accent/5 dark:bg-transparent',
};

const sizes: Record<Size, string> = {
    sm: 'px-4 py-2 ',
    md: 'px-5 py-3 ',
    lg: 'px-6 py-4 ',
};

const classes = computed(() => [
    base,
    variants[props.variant],
    sizes[props.size],
    props.block ? 'w-full' : '',
]);
</script>

<template>
    <button :type="type" :disabled="disabled" :class="classes">
        <slot />
    </button>
</template>
