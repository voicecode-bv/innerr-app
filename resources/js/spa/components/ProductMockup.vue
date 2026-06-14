<script setup lang="ts">
import { computed } from 'vue';
import type {
    AppProductId,
    PrintFormat,
    PrintPhoto,
} from '@/spa/stores/printShop';

const props = withDefaults(
    defineProps<{
        photo: PrintPhoto | null;
        format: PrintFormat;
        appProduct: AppProductId;
        /** Bounding box the framed preview is fitted into (px). */
        maxWidth?: number;
        maxHeight?: number;
        /** Wrap the frame in the soft preview backdrop (off for thumbnails). */
        surface?: boolean;
    }>(),
    {
        maxWidth: 280,
        maxHeight: 220,
        surface: true,
    },
);

// Mirror the API rule so the preview matches the printed result: 'auto'
// products (canvas, puzzle) rotate the page to the photo's orientation, while
// 'fixed' products keep the trim size as written and cover-crop the photo.
const photoIsLandscape = computed<boolean | null>(() => {
    if (
        !props.photo ||
        props.photo.width === null ||
        props.photo.height === null
    ) {
        return null;
    }

    return props.photo.width >= props.photo.height;
});

const dimensions = computed(() => {
    let { width, height } = props.format;
    const formatIsLandscape = width >= height;

    if (
        props.format.orientation === 'auto' &&
        photoIsLandscape.value !== null &&
        photoIsLandscape.value !== formatIsLandscape
    ) {
        [width, height] = [height, width];
    }

    return { width, height };
});

// Fit the frame inside a fixed preview box while keeping the product's aspect
// ratio, so a wide mug and a tall calendar both stay within bounds.
const frameStyle = computed(() => {
    const ratio = dimensions.value.width / dimensions.value.height;

    let width = props.maxWidth;
    let height = width / ratio;

    if (height > props.maxHeight) {
        height = props.maxHeight;
        width = height * ratio;
    }

    return {
        width: `${Math.round(width)}px`,
        height: `${Math.round(height)}px`,
    };
});

// A light per-product treatment so the frame reads as the physical object.
const frameClass: Record<AppProductId, string> = {
    canvas: 'rounded-sm shadow-[0_18px_40px_-12px_rgba(26,31,74,0.5)] ring-1 ring-black/5',
    album: 'rounded-md shadow-lg ring-1 ring-sand-200',
    calendar: 'rounded-sm shadow-md ring-1 ring-sand-200',
    puzzle: 'rounded-md shadow-md ring-1 ring-black/5',
    mug: 'rounded-[1.75rem] shadow-md ring-1 ring-sand-200',
    tshirt: 'rounded-md shadow-md ring-1 ring-sand-200',
};

// Faint die-cut grid hinting at the puzzle pieces, drawn over the photo.
const puzzleGrid = {
    backgroundImage:
        'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px),' +
        'linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
    backgroundSize: '14px 14px',
};
</script>

<template>
    <div
        :class="
            surface
                ? 'flex w-full items-center justify-center rounded-2xl bg-sand-50 px-4 py-6'
                : 'inline-flex'
        "
    >
        <div
            v-if="photo"
            class="relative overflow-hidden bg-white"
            :class="frameClass[appProduct]"
            :style="frameStyle"
        >
            <img :src="photo.url" alt="" class="size-full object-cover" />
            <div
                v-if="appProduct === 'puzzle'"
                aria-hidden="true"
                class="pointer-events-none absolute inset-0 opacity-25"
                :style="puzzleGrid"
            ></div>
        </div>
    </div>
</template>
