<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useSlots } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';

const props = withDefaults(
    defineProps<{
        showHeader?: boolean;
        title?: string;
    }>(),
    {
        showHeader: true,
    },
);

const { t } = useTranslations();
const slots = useSlots();

const hasHeaderLeft = computed(() => !!slots['header-left']);

const mainRef = ref<HTMLElement | null>(null);

// Bij elke nieuwe mount: scroll-positie naar 0 én forceer een paint-pass.
// vue-router's `scrollBehavior` werkt niet voor onze custom scroll-container,
// en WKWebView toont na route-transities soms een lege pagina tot er
// gescrollt wordt — beide opgelost door deze reset.
function resetScroll(): void {
    if (mainRef.value) {
        mainRef.value.scrollTop = 0;
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

// Tik op de bottom-nav-tab waar je al bent (zie de visit-shim in main.ts):
// scroll de huidige pagina vloeiend naar boven.
function scrollToTop(): void {
    mainRef.value?.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(async () => {
    // Drie ronden: direct, na nextTick, na rAF — dekt zowel "DOM staat al klaar"
    // als "transition rondt nog af". WKWebView reageert pas met een paint
    // op één van deze.
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

defineExpose({ mainRef });
</script>

<template>
    <div class="flex h-dvh flex-col">
        <header
            v-if="props.showHeader"
            class="fixed right-[var(--inset-right,0)] left-[var(--inset-left,0)] z-100 flex items-center justify-between border-b border-sand-200 bg-sand px-4 py-3 pt-[var(--inset-top,0)]"
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

        <slot name="above" />

        <main
            ref="mainRef"
            class="flex h-dvh flex-1 flex-col overflow-y-auto pt-[var(--inset-top)]"
            style="transform: translate3d(0, 0, 0); will-change: transform"
        >
            <slot />
        </main>
    </div>
</template>
