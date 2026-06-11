<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import CommentsSheet from '@/spa/components/CommentsSheet.vue';
import LikesSheet from '@/spa/components/LikesSheet.vue';
import PostCard from '@/spa/components/PostCard.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import { useInfiniteScroll } from '@/spa/composables/useInfiniteScroll';
import type { PaginatedResponse } from '@/spa/composables/useInfiniteScroll';
import { useProcessingPoll } from '@/spa/composables/useProcessingPoll';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { vRevealOnScroll } from '@/spa/directives/revealOnScroll';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useFeedCacheStore } from '@/spa/stores/feedCache';

interface Circle {
    id: string;
    name: string;
    photo: string | null;
}

const { t } = useTranslations();
const route = useRoute();
const router = useRouter();
const feedCache = useFeedCacheStore();

const circleId = computed(() => String(route.params.circle));
const feedKey = computed(() => `circle:${circleId.value}`);

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);
const sentinelRef = ref<HTMLElement | null>(null);

const circle = ref<Circle | null>(null);

async function loadCircle(): Promise<void> {
    try {
        const data = await externalApi.get<{ data: Circle }>(
            `/circles/${circleId.value}`,
        );
        circle.value = data.data;
    } catch {
        router.push({ name: 'spa.home' });
    }
}

const cached = feedCache.get<PostData>(feedKey.value);

async function fetchCircleFeed(
    page: number,
): Promise<PaginatedResponse<PostData>> {
    const existingBeforeFetch =
        feedCache.get<PostData>(feedKey.value)?.items ?? [];
    const response = await externalApi.get<PaginatedResponse<PostData>>(
        `/circles/${circleId.value}/feed?page=${page}`,
    );

    if (page === 1) {
        preserveLocalThumbnails(response.data, existingBeforeFetch);
        feedCache.set(feedKey.value, response.data, response.meta.last_page);
    }

    return response;
}

// Zie Feed.vue voor de motivatie. Behoudt de lokale data-URL thumbnail van
// een optimistic of een nog-processing post zodat de PostCard tijdens een
// poll niet leeg flikkert terwijl de CDN-poster nog laadt of ontbreekt.
function preserveLocalThumbnails(
    fresh: PostData[],
    existing: readonly PostData[],
): void {
    const knownById = new Map(existing.map((p) => [p.id, p]));
    const optimisticPool = existing
        .filter((p) => p.id.startsWith('optimistic-') && p.thumbnail_url)
        .slice();

    for (const post of fresh) {
        const known = knownById.get(post.id);

        if (known?.thumbnail_url && !post.thumbnail_url) {
            post.thumbnail_url = known.thumbnail_url;
            post.thumbnail_small_url ??= known.thumbnail_small_url;
            continue;
        }

        if (!known && !post.thumbnail_url && optimisticPool.length > 0) {
            const donor = optimisticPool.shift();

            if (donor?.thumbnail_url) {
                post.thumbnail_url = donor.thumbnail_url;
                post.thumbnail_small_url ??= donor.thumbnail_small_url;
            }
        }
    }
}

const feed = useInfiniteScroll<PostData>(fetchCircleFeed, sentinelRef, {
    immediate: !cached,
    initialItems: cached?.items,
    initialLastPage: cached?.lastPage,
});

// Auto-refresh terwijl een post nog in `media_status='processing'` staat — zie
// de comment in Feed.vue voor de motivatie.
useProcessingPoll(feed.items, () => feed.softRefresh());

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
        feedCache.invalidate(feedKey.value);
        await Promise.all([loadCircle(), feed.reset()]);
    },
    containerRef,
});

onMounted(() => {
    void loadCircle();

    if (cached && !feedCache.isFresh(feedKey.value)) {
        void feed.softRefresh();
    }
});

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

async function onPostUpdated(): Promise<void> {
    feedCache.invalidate(feedKey.value);
    await feed.softRefresh();
}

async function onPostDeleted(postId: string): Promise<void> {
    feed.items.splice(
        0,
        feed.items.length,
        ...feed.items.filter((p) => p.id !== postId),
    );
    feedCache.invalidate(feedKey.value);
    await feed.softRefresh();
}

function activeLikesCount(): number {
    if (likesPostId.value === null) {
        return 0;
    }

    const target = feed.items.find((p) => p.id === likesPostId.value);

    return target?.likes_count ?? 0;
}

function activeCommentsCount(): number {
    if (commentsPostId.value === null) {
        return 0;
    }

    const target = feed.items.find((p) => p.id === commentsPostId.value);

    return target?.comments_count ?? 0;
}

function bumpActivePostCommentsCount(delta: number): void {
    if (commentsPostId.value === null) {
        return;
    }

    const target = feed.items.find((p) => p.id === commentsPostId.value);

    if (target) {
        target.comments_count = Math.max(0, target.comments_count + delta);
    }
}

function goBack(): void {
    if (window.history.length > 1) {
        router.back();
    } else {
        router.push({ name: 'spa.home' });
    }
}
</script>

<template>
    <AppLayout ref="layout" :title="circle?.name ?? t('Circle')">
        <template #header-left>
            <button class="flex items-center text-ink" @click="goBack">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>
        </template>

        <template #header-right>
            <RouterLink
                v-if="circle"
                :to="{ name: 'spa.circles.map', params: { circle: circle.id } }"
                class="flex items-center text-sand-700"
                :aria-label="t('Open map')"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 6.75V15m0-8.25L3.32 4.507a.75.75 0 0 0-1.07.68v11.124c0 .285.165.544.421.666L9 19.5m0-12.75 6 3m-6 9 6-3m0 0V15m0-8.25 5.68-2.243a.75.75 0 0 1 1.07.68v11.124a.75.75 0 0 1-.421.666L15 19.5M15 6.75V15"
                    />
                </svg>
            </RouterLink>
        </template>

        <div
            class="mt-10 pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <template v-if="feed.items.length === 0 && feed.loading">
                <div v-for="n in 3" :key="n">
                    <div class="flex items-center gap-3 px-4 py-3">
                        <div class="size-10 shimmer rounded-full" />
                        <div class="h-3 w-32 shimmer rounded" />
                    </div>
                    <div class="aspect-square w-full shimmer" />
                </div>
            </template>

            <PostCard
                v-for="post in feed.items"
                :key="post.id"
                v-reveal-on-scroll
                class="reveal-on-scroll"
                :post="post"
                @open-comments="openCommentsForPost"
                @open-likes="openLikesForPost"
                @post-updated="onPostUpdated"
                @post-deleted="onPostDeleted"
            />

            <div
                v-if="feed.loading && feed.items.length > 0"
                class="flex items-center justify-center gap-2 py-6 text-sand-500"
            >
                {{ t('Loading more...') }}
            </div>

            <div ref="sentinelRef" class="h-1" />

            <div
                v-if="!feed.loading && feed.items.length === 0"
                class="flex flex-col items-center justify-center px-8 py-20 text-center"
            >
                <div
                    aria-hidden="true"
                    class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-success-soft text-ink dark:bg-brand-blue"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-8"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
                        />
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-ink">
                    {{ t('No moments yet') }}
                </h3>
                <p class="mt-2 text-sand-600">
                    {{ t('Be the first to share something in this circle.') }}
                </p>
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
    </AppLayout>
</template>
