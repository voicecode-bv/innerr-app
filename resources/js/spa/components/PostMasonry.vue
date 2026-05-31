<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import CommentsSheet from '@/spa/components/CommentsSheet.vue';
import LikesSheet from '@/spa/components/LikesSheet.vue';
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

// Liking happens inside each tile; commenting and the likers list open a sheet
// hosted here so every masonry surface (home grid, filter results, profile)
// gets the interaction without wiring it up page by page.
const commentsPostId = ref<string | null>(null);
const isCommentsOpen = ref(false);
const likesPostId = ref<string | null>(null);
const isLikesOpen = ref(false);

function openCommentsForPost(postId: string): void {
    commentsPostId.value = postId;
    isCommentsOpen.value = true;
}

function openLikesForPost(postId: string): void {
    likesPostId.value = postId;
    isLikesOpen.value = true;
}

function findPost(postId: string | null): PostData | undefined {
    return postId === null
        ? undefined
        : props.posts.find((post) => post.id === postId);
}

function activeCommentsCount(): number {
    return findPost(commentsPostId.value)?.comments_count ?? 0;
}

function activeLikesCount(): number {
    return findPost(likesPostId.value)?.likes_count ?? 0;
}

function bumpActivePostCommentsCount(delta: number): void {
    const target = findPost(commentsPostId.value);

    if (target) {
        target.comments_count = Math.max(0, target.comments_count + delta);
    }
}

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
    <div>
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
                        :style="{
                            aspectRatio: n % 2 === 0 ? '3 / 4' : '1 / 1',
                        }"
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
                    @open-comments="openCommentsForPost"
                    @open-likes="openLikesForPost"
                />
            </div>
        </div>

        <CommentsSheet
            v-if="commentsPostId !== null"
            :open="isCommentsOpen"
            :post-id="commentsPostId"
            :comments-count="activeCommentsCount()"
            @update:open="isCommentsOpen = $event"
            @comment-added="bumpActivePostCommentsCount(1)"
            @comment-deleted="bumpActivePostCommentsCount(-1)"
        />

        <LikesSheet
            v-if="likesPostId !== null"
            :open="isLikesOpen"
            :post-id="likesPostId"
            :initial-count="activeLikesCount()"
            @update:open="isLikesOpen = $event"
        />
    </div>
</template>
