<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import VideoPlayer from '@/spa/components/VideoPlayer.vue';

export interface CarouselItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    thumbnail?: string | null;
    alt?: string;
}

const props = withDefaults(
    defineProps<{
        items: CarouselItem[];
        activeIndex?: number;
        rounded?: boolean;
        hint?: boolean;
        arrows?: boolean;
    }>(),
    {
        activeIndex: 0,
        rounded: false,
        hint: true,
        arrows: true,
    },
);

const emit = defineEmits<{
    (e: 'update:activeIndex', index: number): void;
}>();

const scroller = ref<HTMLDivElement | null>(null);
const internalIndex = ref(props.activeIndex);
const hinting = ref(false);

watch(
    () => props.activeIndex,
    (next) => {
        if (next === internalIndex.value) {
            return;
        }

        internalIndex.value = next;
        scrollToIndex(next);
    },
);

function scrollToIndex(index: number): void {
    const el = scroller.value;

    if (!el) {
        return;
    }

    const slide = el.children[index] as HTMLElement | undefined;

    if (slide) {
        el.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    }
}

// Debounce-by-frame: scroll-snap fires many scroll events; we only need the
// final resting slide.
let rafHandle = 0;
function onScroll(): void {
    // Negeer scroll-events tijdens de hint zodat de programmatische peek niet
    // ten onrechte activeIndex op slide 1 zet voordat hij terugscrollt.
    if (hinting.value) {
        return;
    }

    if (rafHandle) {
        cancelAnimationFrame(rafHandle);
    }

    rafHandle = requestAnimationFrame(() => {
        const el = scroller.value;

        if (!el) {
            return;
        }

        const width = el.clientWidth;

        if (width === 0) {
            return;
        }

        const index = Math.round(el.scrollLeft / width);

        if (
            index !== internalIndex.value &&
            index >= 0 &&
            index < props.items.length
        ) {
            internalIndex.value = index;
            emit('update:activeIndex', index);
        }
    });
}

const canGoPrev = computed(() => internalIndex.value > 0);
const canGoNext = computed(() => internalIndex.value < props.items.length - 1);

function goToPrev(): void {
    if (!canGoPrev.value) {
        return;
    }

    scrollToIndex(internalIndex.value - 1);
}

function goToNext(): void {
    if (!canGoNext.value) {
        return;
    }

    scrollToIndex(internalIndex.value + 1);
}

// Swipe-hint: bij eerste keer dat de carousel >=50% in beeld komt, even naar
// rechts peeken en terug. Geeft de gebruiker visueel mee dat er meer slides
// zijn zonder een tutorial-overlay nodig te hebben.
let hintFired = false;
let intersectionObserver: IntersectionObserver | null = null;

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateScroll(
    el: HTMLElement,
    from: number,
    to: number,
    duration: number,
): Promise<void> {
    return new Promise((resolve) => {
        const start = performance.now();

        function step(now: number): void {
            const t = Math.min(1, (now - start) / duration);
            el.scrollLeft = from + (to - from) * easeInOutCubic(t);

            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(step);
    });
}

function prefersReducedMotion(): boolean {
    return (
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
        false
    );
}

async function runSwipeHint(): Promise<void> {
    if (
        hintFired ||
        !props.hint ||
        props.items.length <= 1 ||
        prefersReducedMotion()
    ) {
        return;
    }

    const el = scroller.value;

    if (!el) {
        return;
    }

    hintFired = true;
    hinting.value = true;

    // scroll-snap-mandatory zou onze partial-peek terugklikken naar 0; tijdens
    // de hint dus tijdelijk uitschakelen en daarna herstellen.
    const previousSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = 'none';

    try {
        const peek = Math.min(48, el.clientWidth * 0.12);
        await animateScroll(el, 0, peek, 320);
        await new Promise((r) => setTimeout(r, 120));
        await animateScroll(el, peek, 0, 380);
    } finally {
        el.style.scrollSnapType = previousSnap;
        hinting.value = false;
    }
}

onMounted(() => {
    const el = scroller.value;

    if (!el || props.items.length <= 1) {
        return;
    }

    intersectionObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    setTimeout(runSwipeHint, 250);
                    intersectionObserver?.disconnect();
                    intersectionObserver = null;

                    return;
                }
            }
        },
        { threshold: 0.5 },
    );

    intersectionObserver.observe(el);
});

onBeforeUnmount(() => {
    intersectionObserver?.disconnect();
    intersectionObserver = null;
});
</script>

<template>
    <div class="relative size-full">
        <div
            ref="scroller"
            class="flex size-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
            :class="{ 'rounded-lg': rounded }"
            style="scrollbar-width: none"
            @scroll="onScroll"
        >
            <div
                v-for="(item, index) in items"
                :key="item.id"
                class="relative size-full shrink-0 snap-center snap-always"
            >
                <VideoPlayer
                    v-if="item.type === 'video'"
                    :src="item.url"
                    :poster="item.thumbnail"
                    class="size-full object-cover"
                    controls
                    crossorigin="anonymous"
                />
                <img
                    v-else
                    :src="item.url"
                    class="size-full object-cover"
                    :alt="item.alt ?? ''"
                    :loading="index === 0 ? 'eager' : 'lazy'"
                />
                <slot name="slide-overlay" :item="item" :index="index" />
            </div>
        </div>

        <template v-if="arrows && items.length > 1">
            <button
                v-show="canGoPrev"
                type="button"
                class="absolute top-1/2 left-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-opacity active:bg-black/45"
                :aria-label="$slots.prevLabel ? undefined : 'Previous'"
                @click.stop="goToPrev"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                    class="size-4"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>

            <button
                v-show="canGoNext"
                type="button"
                class="absolute top-1/2 right-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-opacity active:bg-black/45"
                aria-label="Next"
                @click.stop="goToNext"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                    class="size-4"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                </svg>
            </button>
        </template>
    </div>
</template>

<style scoped>
div[ref='scroller']::-webkit-scrollbar,
.overflow-x-auto::-webkit-scrollbar {
    display: none;
}
</style>
