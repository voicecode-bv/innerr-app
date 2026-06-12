<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import VideoPlayer from '@/spa/components/VideoPlayer.vue';
import { vPinchZoom } from '@/spa/directives/pinchZoom';
import { prefersReducedMotion } from '@/spa/services/motion';

export interface CarouselItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    thumbnail?: string | null;
    /** Small thumbnail rendered blurred under the image while it loads. */
    thumbnailSmall?: string | null;
    alt?: string;
}

const props = withDefaults(
    defineProps<{
        items: CarouselItem[];
        activeIndex?: number;
        rounded?: boolean;
        hint?: boolean;
        arrows?: boolean;
        indicators?: boolean;
        /** Positioning class for the indicator pill, e.g. 'bottom-12' when a
            bottom overlay (action bar) would otherwise cover it. */
        indicatorClass?: string;
    }>(),
    {
        activeIndex: 0,
        rounded: false,
        hint: true,
        arrows: true,
        indicators: true,
        indicatorClass: 'bottom-3',
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
    // Ignore scroll events during the hint so the programmatic peek doesn't
    // wrongly set activeIndex to slide 1 before it scrolls back.
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

// Swipe hint: the first time the carousel comes >=50% into view, briefly peek
// to the right and back. Visually tells the user there are more slides
// without needing a tutorial overlay.
let hintFired = false;
let intersectionObserver: IntersectionObserver | null = null;

// Per-slide image load state driving the shimmer/blur-up placeholder fade.
const loadedItems = ref<Record<string, boolean>>({});

function markLoaded(id: string): void {
    loadedItems.value[id] = true;
}

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

    // scroll-snap-mandatory would snap our partial peek back to 0; so disable
    // it temporarily during the hint and restore it afterwards.
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

    // Non-zero start (e.g. deep link to a specific slide): jump straight to
    // it without animation. The `watch` on `activeIndex` only does this for
    // later changes, so we set the initial position here ourselves.
    if (internalIndex.value > 0) {
        const slide = el.children[internalIndex.value] as
            | HTMLElement
            | undefined;

        if (slide) {
            el.scrollLeft = slide.offsetLeft;
        }

        // Skip the swipe hint: it assumes slide 0 and would scroll back.
        hintFired = true;

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
                    v-pinch-zoom
                    :src="item.url"
                    :poster="item.thumbnail"
                    class="size-full object-cover"
                    controls
                    crossorigin="anonymous"
                />
                <template v-else>
                    <!-- Placeholder underlays stay mounted while the photo fades
                         in on top (classic blur-up), so the slide never flashes
                         the bare background mid-transition. Once loaded the
                         shimmer swaps to a static background to stop animating. -->
                    <div
                        class="absolute inset-0"
                        :class="loadedItems[item.id] ? 'bg-surface' : 'shimmer'"
                    />
                    <img
                        v-if="item.thumbnailSmall"
                        :src="item.thumbnailSmall"
                        alt=""
                        aria-hidden="true"
                        class="absolute inset-0 size-full scale-105 object-cover blur-md"
                    />
                    <img
                        v-pinch-zoom
                        :src="item.url"
                        class="relative size-full object-cover transition-opacity duration-500"
                        :class="
                            loadedItems[item.id] ? 'opacity-100' : 'opacity-0'
                        "
                        :alt="item.alt ?? ''"
                        :loading="index === 0 ? 'eager' : 'lazy'"
                        @load="markLoaded(item.id)"
                    />
                </template>
                <slot name="slide-overlay" :item="item" :index="index" />
            </div>
        </div>

        <template v-if="arrows && items.length > 1">
            <button
                v-show="canGoPrev"
                type="button"
                class="hit-slop absolute top-1/2 left-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-opacity active:bg-black/45"
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
                class="hit-slop absolute top-1/2 right-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-opacity active:bg-black/45"
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

        <!-- Slide position indicator: dots for a handful of slides, a compact
             counter when there are too many dots to read at a glance. Purely
             indicative (pointer-events-none) so it never steals media taps. -->
        <div
            v-if="indicators && items.length > 1"
            class="pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full bg-black/30 backdrop-blur-sm"
            :class="[
                indicatorClass,
                items.length <= 10 ? 'gap-1.5 px-2.5 py-2' : 'px-2.5 py-1',
            ]"
            aria-hidden="true"
        >
            <template v-if="items.length <= 10">
                <span
                    v-for="(item, index) in items"
                    :key="item.id"
                    class="size-1.5 rounded-full transition-all duration-200"
                    :class="
                        index === internalIndex
                            ? 'scale-125 bg-white'
                            : 'bg-white/50'
                    "
                />
            </template>
            <span v-else class="text-xs font-medium text-white">
                {{ internalIndex + 1 }}/{{ items.length }}
            </span>
        </div>
    </div>
</template>

<style scoped>
div[ref='scroller']::-webkit-scrollbar,
.overflow-x-auto::-webkit-scrollbar {
    display: none;
}
</style>
