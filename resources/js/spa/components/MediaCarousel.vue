<script setup lang="ts">
import { computed, ref, watch } from 'vue';

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
    }>(),
    {
        activeIndex: 0,
        rounded: false,
    },
);

const emit = defineEmits<{
    (e: 'update:activeIndex', index: number): void;
}>();

const scroller = ref<HTMLDivElement | null>(null);
const internalIndex = ref(props.activeIndex);

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

const dots = computed(() => props.items.map((_, i) => i));
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
                v-for="item in items"
                :key="item.id"
                class="relative size-full shrink-0 snap-center snap-always"
            >
                <video
                    v-if="item.type === 'video'"
                    :src="item.url"
                    :poster="item.thumbnail ?? undefined"
                    class="size-full object-cover"
                    controls
                />
                <img
                    v-else
                    :src="item.url"
                    class="size-full object-cover"
                    :alt="item.alt ?? ''"
                    :loading="
                        dots.indexOf(internalIndex) === 0 ? 'eager' : 'lazy'
                    "
                />
                <slot
                    name="slide-overlay"
                    :item="item"
                    :index="dots.indexOf(internalIndex)"
                />
            </div>
        </div>

        <div
            v-if="items.length > 1"
            class="pointer-events-none absolute right-0 bottom-3 left-0 flex justify-center gap-1.5"
        >
            <span
                v-for="i in dots"
                :key="i"
                class="size-1.5 rounded-full transition-all duration-200"
                :class="i === internalIndex ? 'w-4 bg-white' : 'bg-white/60'"
            />
        </div>
    </div>
</template>

<style scoped>
div[ref='scroller']::-webkit-scrollbar,
.overflow-x-auto::-webkit-scrollbar {
    display: none;
}
</style>
