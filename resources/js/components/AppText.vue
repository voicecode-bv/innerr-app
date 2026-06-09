<script setup lang="ts">
import { computed } from 'vue';

// Shared typography component. Pick a `variant` preset for the size/weight/font
// treatment from the brand type scale, and a `tone` preset for colour. The
// rendered element defaults to a sensible semantic tag per variant (overridable
// with `as`). Extra classes passed by the caller fall through and merge, so
// one-off tweaks (margins, truncation) stay possible without new presets.
type Variant =
    | 'hero' // page hero title (onboarding) — DM Sans 900
    | 'title' // page / modal title
    | 'heading' // section heading / card title
    | 'subheading' // smaller heading
    | 'eyebrow' // tiny uppercase label above a title
    | 'body' // default paragraph
    | 'body-lg' // prominent paragraph
    | 'caption' // metadata / secondary text
    | 'label'; // form / UI label

type Tone = 'default' | 'muted' | 'sand' | 'accent' | 'inherit';

const props = withDefaults(
    defineProps<{
        variant?: Variant;
        tone?: Tone;
        as?: string;
    }>(),
    {
        variant: 'body',
        tone: 'default',
        as: undefined,
    },
);

const variants: Record<Variant, string> = {
    // Titles use DM Sans (font-sans) rather than the Fraunces display face.
    hero: 'font-sans text-4xl font-black tracking-tight',
    title: 'font-sans text-2xl font-semibold tracking-tight',
    heading: 'font-sans text-xl font-semibold',
    subheading: 'font-sans text-lg font-semibold',
    eyebrow: 'text-xs font-medium uppercase tracking-wider',
    body: 'font-sans text-base font-medium',
    'body-lg': 'font-sans text-lg font-medium',
    caption: 'font-sans text-sm',
    label: 'font-sans text-sm font-semibold',
};

// Semantic default element per variant; `as` overrides it.
const defaultTags: Record<Variant, string> = {
    hero: 'h1',
    title: 'h1',
    heading: 'h2',
    subheading: 'h3',
    eyebrow: 'p',
    body: 'p',
    'body-lg': 'p',
    caption: 'p',
    label: 'span',
};

const tones: Record<Tone, string> = {
    default: 'text-ink',
    muted: 'text-ink-muted',
    sand: 'text-brand-sand',
    accent: 'text-accent',
    inherit: '',
};

const tag = computed(() => props.as ?? defaultTags[props.variant]);
const classes = computed(() => [variants[props.variant], tones[props.tone]]);
</script>

<template>
    <component :is="tag" :class="classes">
        <slot />
    </component>
</template>
