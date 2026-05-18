<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink  } from 'vue-router';
import type {RouteLocationRaw} from 'vue-router';

type Variant = 'primary' | 'inverse' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const props = withDefaults(
    defineProps<{
        variant?: Variant;
        size?: Size;
        type?: 'button' | 'submit' | 'reset';
        disabled?: boolean;
        block?: boolean;
        to?: RouteLocationRaw;
        href?: string;
    }>(),
    {
        variant: 'primary',
        size: 'md',
        type: 'button',
        disabled: false,
        block: false,
        to: undefined,
        href: undefined,
    },
);

const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40';

const variants: Record<Variant, string> = {
    primary:
        'rounded-full bg-teal text-white font-medium hover:bg-teal-light shadow-lg shadow-teal/20',
    // Inverse — yellow on green text. Use on dark brand surfaces (Brand
    // Blue, Brand Green, Brand Orange) where the solid teal primary would
    // disappear.
    inverse:
        'rounded-full bg-brand-yellow text-brand-green font-semibold hover:bg-brand-yellow/90 shadow-lg shadow-night/30',
    secondary:
        'rounded-full bg-white text-teal font-medium border border-sand-200 hover:bg-sand-50',
    ghost: 'rounded-full bg-transparent text-teal-muted font-medium hover:bg-teal/5',
    // Destructive — only ever solid blush. Use for log out, delete account,
    // remove person, leave circle. Pair with a confirm dialog before the
    // action actually fires.
    danger: 'rounded-full bg-blush-600 text-white font-semibold hover:bg-blush-700 shadow-sm shadow-blush-600/20 focus-visible:ring-blush-400/40',
};

const sizes: Record<Size, string> = {
    sm: 'px-4 py-2',
    md: 'px-5 py-3',
    lg: 'px-6 py-4',
};

const classes = computed(() => [
    base,
    variants[props.variant],
    sizes[props.size],
    props.block ? 'w-full' : '',
]);
</script>

<template>
    <RouterLink v-if="to" :to="to" :class="classes">
        <slot />
    </RouterLink>
    <a v-else-if="href" :href="href" :class="classes">
        <slot />
    </a>
    <button v-else :type="type" :disabled="disabled" :class="classes">
        <slot />
    </button>
</template>
