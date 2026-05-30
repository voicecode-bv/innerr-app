<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import PostTile from '@/spa/components/PostTile.vue';
import { useMasonry } from '@/spa/composables/useMasonry';

const props = withDefaults(
    defineProps<{
        posts: PostData[];
        loading?: boolean;
        /**
         * Optional per-tile poster override, forwarded to each PostTile.
         * Profiles use it to surface locally-generated thumbnails for videos
         * that are still transcoding.
         */
        resolvePoster?: (post: PostData) => string | null;
    }>(),
    {
        loading: false,
        resolvePoster: undefined,
    },
);

// Responsive column count from the grid's own width: 2 on phones, more on
// wider tablets. Driven by a ResizeObserver so it adapts to rotation/split-view.
const gridRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

const columnCount = computed(() => {
    const width = containerWidth.value;

    if (width >= 1024) {
        return 4;
    }

    if (width >= 640) {
        return 3;
    }

    return 2;
});

// Tiles are pure media, so column balancing is driven purely by each item's
// aspect ratio (no caption/footer height to estimate).
const { columns } = useMasonry(() => props.posts, columnCount, {
    footerWeight: 0,
});

onMounted(() => {
    if (typeof ResizeObserver !== 'undefined' && gridRef.value) {
        resizeObserver = new ResizeObserver((entries) => {
            containerWidth.value = entries[0]?.contentRect.width ?? 0;
        });
        resizeObserver.observe(gridRef.value);
    } else if (gridRef.value) {
        containerWidth.value = gridRef.value.clientWidth;
    }
});

onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
});
</script>

<template>
    <div ref="gridRef" class="flex gap-2 px-2">
        <template v-if="loading && posts.length === 0">
            <div
                v-for="col in columnCount"
                :key="col"
                class="flex min-w-0 flex-1 flex-col gap-2"
            >
                <div
                    v-for="n in 3"
                    :key="n"
                    class="animate-pulse rounded-2xl bg-sand"
                    :style="{ aspectRatio: n % 2 === 0 ? '3 / 4' : '1 / 1' }"
                />
            </div>
        </template>

        <div
            v-for="(column, index) in columns"
            v-else
            :key="index"
            class="flex min-w-0 flex-1 flex-col gap-2"
        >
            <PostTile
                v-for="post in column"
                :key="post.id"
                :post="post"
                :resolve-poster="resolvePoster"
            />
        </div>
    </div>
</template>
