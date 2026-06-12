<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    onUnmounted,
    ref,
    useSlots,
} from 'vue';
import { useScrollHeader } from '@/spa/composables/useScrollHeader';
import {
    recallScroll,
    rememberScroll,
} from '@/spa/composables/useScrollMemory';
import { useTranslations } from '@/spa/composables/useTranslations';
import { prefersReducedMotion } from '@/spa/services/motion';

const props = withDefaults(
    defineProps<{
        showHeader?: boolean;
        title?: string;
        // When set, the layout remembers the scroll position under this key
        // and restores it on return (instead of resetting to the top). That
        // way you come back to where you were after opening a detail page.
        // Without a key the old behavior remains: every mount scrolls to top.
        scrollKey?: string;
    }>(),
    {
        showHeader: true,
    },
);

const { t } = useTranslations();
const slots = useSlots();

const hasHeaderLeft = computed(() => !!slots['header-left']);

const mainRef = ref<HTMLElement | null>(null);

// Switch the header to a translucent blur once content is scrolled
// underneath it. Exposed to the `above` slot so page-specific headers
// (FeedHeader) follow along.
const { elevated: headerElevated } = useScrollHeader(mainRef);

// On every fresh mount: set the scroll position (restored or 0) and force a
// paint pass. vue-router's `scrollBehavior` doesn't work for our custom
// scroll container, and WKWebView sometimes shows a blank page after route
// transitions until the user scrolls; this reset fixes both. With a
// `scrollKey` we restore the remembered position so you return where you were.
function resetScroll(): void {
    const restored =
        props.scrollKey !== undefined
            ? recallScroll(props.scrollKey)
            : undefined;

    if (mainRef.value) {
        mainRef.value.scrollTop = restored ?? 0;
    }

    if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);

        if (document.documentElement) {
            document.documentElement.scrollTop = 0;
        }

        if (document.body) {
            document.body.scrollTop = 0;
        }
    }
}

// Tapping the bottom-nav tab you are already on (see the visit shim in
// main.ts): smoothly scroll the current page to the top.
function scrollToTop(): void {
    mainRef.value?.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
}

onMounted(async () => {
    // Three rounds: immediately, after nextTick, after rAF — covers both "DOM
    // is already ready" and "transition is still finishing". WKWebView only
    // responds with a paint on one of these.
    resetScroll();
    await nextTick();
    resetScroll();

    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
            resetScroll();
            requestAnimationFrame(resetScroll);
        });
    }
});

onMounted(() => {
    window.addEventListener('spa:tab-reselect', scrollToTop);
});

onUnmounted(() => {
    window.removeEventListener('spa:tab-reselect', scrollToTop);
});

// Remember the current scroll position before the page disappears (e.g. when
// opening a post detail), so we can restore it on return.
onBeforeUnmount(() => {
    if (props.scrollKey !== undefined && mainRef.value) {
        rememberScroll(props.scrollKey, mainRef.value.scrollTop);
    }
});

defineExpose({ mainRef });
</script>

<template>
    <div class="flex h-dvh flex-col">
        <header
            v-if="props.showHeader"
            class="fixed right-[var(--inset-right,0)] left-[var(--inset-left,0)] z-100 flex items-center justify-between border-b border-sand-200 px-4 py-3 pt-[var(--inset-top,0)] transition-[background-color] duration-300 motion-reduce:transition-none"
            :class="headerElevated ? 'bg-sand/85 backdrop-blur-md' : 'bg-sand'"
        >
            <div class="flex w-16 items-center">
                <slot name="header-left">
                    <span v-if="!hasHeaderLeft" />
                </slot>
            </div>
            <h1
                class="min-w-0 flex-1 truncate text-center font-sans text-lg font-semibold tracking-tight text-ink"
            >
                <slot name="title">{{ title ?? t('Innerr') }}</slot>
            </h1>
            <div class="flex w-16 items-center justify-end">
                <slot name="header-right" />
            </div>
        </header>

        <slot name="above" :header-elevated="headerElevated" />

        <main
            ref="mainRef"
            class="flex h-dvh flex-1 flex-col overflow-y-auto pt-[var(--inset-top)]"
            style="transform: translate3d(0, 0, 0); will-change: transform"
        >
            <slot />
        </main>
    </div>
</template>
