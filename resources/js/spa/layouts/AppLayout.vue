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
        // Wanneer gezet onthoudt de layout de scroll-positie onder deze sleutel
        // en herstelt 'm bij terugkeer (i.p.v. naar boven te resetten). Zo kom
        // je na het openen van een detailpagina weer terug waar je was. Zonder
        // sleutel blijft het oude gedrag: elke mount scrollt naar boven.
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

// Bij elke nieuwe mount: zet de scroll-positie (hersteld of 0) én forceer een
// paint-pass. vue-router's `scrollBehavior` werkt niet voor onze custom
// scroll-container, en WKWebView toont na route-transities soms een lege pagina
// tot er gescrollt wordt — beide opgelost door deze reset. Met een `scrollKey`
// herstellen we de onthouden positie zodat je terugkomt waar je was.
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

// Tik op de bottom-nav-tab waar je al bent (zie de visit-shim in main.ts):
// scroll de huidige pagina vloeiend naar boven.
function scrollToTop(): void {
    mainRef.value?.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
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

// Onthoud de huidige scroll-positie voordat de pagina verdwijnt (bv. bij het
// openen van een postdetail), zodat we 'm bij terugkeer kunnen herstellen.
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
