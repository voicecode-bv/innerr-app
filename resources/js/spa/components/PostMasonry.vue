<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import Button from '@/components/Button.vue';
import BatchAssignCircleSheet from '@/spa/components/BatchAssignCircleSheet.vue';
import CommentsSheet from '@/spa/components/CommentsSheet.vue';
import LikesSheet from '@/spa/components/LikesSheet.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import PostTile from '@/spa/components/PostTile.vue';
import { useMasonry } from '@/spa/composables/useMasonry';
import { useTranslations } from '@/spa/composables/useTranslations';
import { addPostsToCircles } from '@/spa/services/postCircles';
import { useCirclesStore } from '@/spa/stores/circles';
import { useFeedSelectionStore } from '@/spa/stores/feedSelection';
import { Dialog } from '@nativephp/mobile';

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
        /**
         * Enables the "select photos and add them to a circle" flow on this
         * surface. The Select toggle lives in the page header and drives the
         * shared selection store; this masonry then renders the checkboxes,
         * action bar, and circle sheet.
         */
        selectable?: boolean;
    }>(),
    {
        loading: false,
        resolvePoster: undefined,
        selectable: false,
    },
);

const { t } = useTranslations();
const selection = useFeedSelectionStore();
const circlesStore = useCirclesStore();

const selectionActive = computed(() => props.selectable && selection.active);

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

// Batch "add to circle" flow, hosted here so every selectable masonry surface
// (home grid, own profile) gets it for free.
const assignSheetOpen = ref(false);
const assignSubmitting = ref(false);

function mergeCirclesIntoSelectedPosts(circleIds: string[]): void {
    const chosen = (circlesStore.items ?? [])
        .filter((circle) => circleIds.includes(circle.id))
        .map((circle) => ({
            id: circle.id,
            name: circle.name,
            photo: circle.photo,
        }));

    for (const post of props.posts) {
        if (!selection.selectedIds.has(post.id)) {
            continue;
        }

        const existing = post.circles ?? [];
        const additions = chosen.filter(
            (circle) => !existing.some((current) => current.id === circle.id),
        );
        post.circles = [...existing, ...additions];
    }
}

async function onConfirmAssign(circleIds: string[]): Promise<void> {
    const postIds = [...selection.selectedIds];

    if (postIds.length === 0 || circleIds.length === 0) {
        return;
    }

    assignSubmitting.value = true;

    try {
        await addPostsToCircles(postIds, circleIds);
        mergeCirclesIntoSelectedPosts(circleIds);
        assignSheetOpen.value = false;
        selection.disable();
        await Dialog.toast(
            postIds.length === 1
                ? t('Photo added to your circles')
                : t('Photos added to your circles'),
        );
    } catch {
        await Dialog.alert(
            t('Something went wrong'),
            t('Could not add the photos to the circles. Please try again.'),
        );
    } finally {
        assignSubmitting.value = false;
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
                        class="shimmer rounded-2xl"
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
                    :data-created-at="post.created_at"
                    :data-taken-at="post.taken_at ?? undefined"
                    :post="post"
                    :resolve-poster="resolvePoster"
                    :selection-mode="selectionActive"
                    :selected="selection.isSelected(post.id)"
                    @open-comments="openCommentsForPost"
                    @open-likes="openLikesForPost"
                    @toggle-select="selection.toggle"
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

        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="translate-y-full"
                enter-to-class="translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="translate-y-0"
                leave-to-class="translate-y-full"
            >
                <div
                    v-if="selectionActive && selection.count > 0"
                    class="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-between gap-3 border-t border-sand-200 bg-surface px-4 pt-3 pb-24 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
                >
                    <span class="font-medium text-ink">
                        {{ t(':count selected', { count: selection.count }) }}
                    </span>
                    <Button
                        variant="primary"
                        size="md"
                        @click="assignSheetOpen = true"
                    >
                        {{ t('Add to circle') }}
                    </Button>
                </div>
            </Transition>
        </Teleport>

        <BatchAssignCircleSheet
            v-if="selectable"
            v-model:open="assignSheetOpen"
            :post-count="selection.count"
            :submitting="assignSubmitting"
            @confirm="onConfirmAssign"
        />
    </div>
</template>
