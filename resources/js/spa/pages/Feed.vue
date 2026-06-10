<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { RouterLink } from 'vue-router';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import CommentsSheet from '@/spa/components/CommentsSheet.vue';
import FeedHeader from '@/spa/components/FeedHeader.vue';
import FeedLayoutChooser from '@/spa/components/FeedLayoutChooser.vue';
import LikesSheet from '@/spa/components/LikesSheet.vue';
import PostCard from '@/spa/components/PostCard.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import PushPermissionCard from '@/spa/components/PushPermissionCard.vue';
import { useChildFeedQuery } from '@/spa/composables/useChildFeedQuery';
import { useFeedDateBar } from '@/spa/composables/useFeedDateBar';
import { useInfiniteScroll } from '@/spa/composables/useInfiniteScroll';
import type { PaginatedResponse } from '@/spa/composables/useInfiniteScroll';
import { useProcessingPoll } from '@/spa/composables/useProcessingPoll';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { vRevealOnScroll } from '@/spa/directives/revealOnScroll';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useChildFilterStore } from '@/spa/stores/childFilter';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { useNotificationsStore } from '@/spa/stores/notifications';
import cameraIcon from '../../../svg/doodle-icons/camera.svg';
import starIcon from '../../../svg/doodle-icons/star.svg';

const { t } = useTranslations();
const feedCache = useFeedCacheStore();
const childFilter = useChildFilterStore();
const notificationsStore = useNotificationsStore();
const { childFeedQuery } = useChildFeedQuery();
const FEED_KEY = 'home';

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);
const sentinelRef = ref<HTMLElement | null>(null);
const permissionCardRef =
    useTemplateRef<InstanceType<typeof PushPermissionCard>>('permissionCard');

async function loadUnreadCount(): Promise<void> {
    try {
        await notificationsStore.refresh();
    } catch {
        // negeren — badge blijft op laatst bekende waarde
    }
}

const cached = feedCache.get<PostData>(FEED_KEY);

async function fetchFeed(page: number): Promise<PaginatedResponse<PostData>> {
    const existingBeforeFetch = feedCache.get<PostData>(FEED_KEY)?.items ?? [];
    const response = await externalApi.get<PaginatedResponse<PostData>>(
        `/feed?${await childFeedQuery(page)}`,
    );

    if (page === 1) {
        preserveLocalThumbnails(response.data, existingBeforeFetch);
        feedCache.set(FEED_KEY, response.data, response.meta.last_page);
    }

    return response;
}

// Behoud client-side gegenereerde thumbnails (van NativeMedia.thumbnail, zit
// op de optimistic post als `data:image/jpeg;base64,…`) zodra een verse
// API-respons de optimistic vervangt door de echte post — of de bestaande
// echte post nog op `processing` staat zonder CDN-poster. Zonder dit zou de
// thumbnail wegvallen tijdens de eerste poll na een upload, want de PostCard
// remount op de nieuwe id en de CDN-poster is op dat moment ofwel nog niet
// klaar (`thumbnail_url === null`), ofwel haalbaar maar met netwerk-latentie.
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

        // Optimistic→real swap: de verse post heeft een id die we nog niet
        // kennen, en er staat nog een optimistic in de cache met dezelfde
        // strekking. Verplaats z'n data-URL thumbnail naar de nieuwe post.
        if (!known && !post.thumbnail_url && optimisticPool.length > 0) {
            const donor = optimisticPool.shift();

            if (donor?.thumbnail_url) {
                post.thumbnail_url = donor.thumbnail_url;
                post.thumbnail_small_url ??= donor.thumbnail_small_url;
            }
        }
    }
}

const feed = useInfiniteScroll<PostData>(fetchFeed, sentinelRef, {
    immediate: !cached,
    initialItems: cached?.items,
    initialLastPage: cached?.lastPage,
});

// Sticky date bar: shows the month + year of the timeline at the current scroll
// position, pinned just below the dynamic-height header.
const { dateBarRef, currentDateLabel, headerBottom, recompute } =
    useFeedDateBar(containerRef, () => feed.items.length);

// Zolang er posts in de feed staan met media_status='processing' (typisch een
// vers ge-uploade video die nog getranscodeerd wordt), refreshen we de feed
// elke 5s. Zodra de server status 'ready' meldt is de poll uitgeschakeld en
// switcht de PostCard van spinner+poster naar de echte VideoPlayer.
useProcessingPoll(feed.items, () => feed.softRefresh());

// Re-fetch when the child filter changes (shared with the grid view), then
// refresh the date bar.
watch(
    () => childFilter.selectedIds,
    async () => {
        feedCache.invalidate(FEED_KEY);
        await feed.reset();
        recompute();
    },
);

onMounted(() => {
    // Cache toonbaar maar verlopen → fetch op de achtergrond zonder lege flits.
    if (cached && !feedCache.isFresh(FEED_KEY)) {
        void feed.softRefresh();
    }
});

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
        feedCache.invalidate(FEED_KEY);
        notificationsStore.invalidate();
        await Promise.all([
            loadUnreadCount(),
            feed.reset(),
            permissionCardRef.value?.refresh() ?? Promise.resolve(),
        ]);
    },
    containerRef,
});

onMounted(loadUnreadCount);

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
    feedCache.invalidate(FEED_KEY);
    await feed.softRefresh();
}

async function onPushPermissionChanged(): Promise<void> {
    // Nadat de gebruiker de native prompt heeft beantwoord — granted óf denied
    // — willen we een verse feed tonen zonder visuele schok.
    feedCache.invalidate(FEED_KEY);
    await feed.softRefresh();
}

async function onPostDeleted(postId: string): Promise<void> {
    feed.items.splice(
        0,
        feed.items.length,
        ...feed.items.filter((p) => p.id !== postId),
    );
    feedCache.invalidate(FEED_KEY);
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

function iconMaskStyle(url: string) {
    return {
        maskImage: `url(${url})`,
        WebkitMaskImage: `url(${url})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
    };
}
</script>

<template>
    <AppLayout ref="layout" :show-header="false" scroll-key="spa.home">
        <template #above="{ headerElevated }">
            <FeedHeader layout="list" :elevated="headerElevated" />
            <!-- Sticky date bar pinned just below the fixed header (its bottom
                 sits at inset-top + the feed's mt-36). Shows the month + year of
                 the timeline at the current scroll position. -->
            <div
                v-if="feed.items.length > 0"
                ref="dateBarRef"
                aria-hidden="true"
                :style="{ top: `${headerBottom}px` }"
                class="pointer-events-none fixed right-[var(--inset-right,0px)] left-[var(--inset-left,0px)] z-[60] flex h-8 items-center justify-center transition-[background-color] duration-300 motion-reduce:transition-none"
                :class="
                    headerElevated ? 'bg-sand/85 backdrop-blur-md' : 'bg-sand'
                "
            >
                <span
                    class="text-sm font-semibold tracking-wider text-ink-muted uppercase"
                >
                    {{ currentDateLabel }}
                </span>
            </div>
        </template>

        <div
            class="relative mt-36 pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <PushPermissionCard
                ref="permissionCard"
                class="mx-4 mt-6"
                dismissible
                @permission-changed="onPushPermissionChanged"
            />

            <template v-if="feed.items.length === 0 && feed.loading">
                <div v-for="n in 3" :key="n">
                    <div class="flex items-center gap-3 px-4 py-3">
                        <div class="size-10 shimmer rounded-full" />
                        <div class="h-3 w-32 shimmer rounded" />
                    </div>
                    <div class="aspect-square w-full shimmer" />
                    <div class="space-y-2 px-4 py-3">
                        <div class="h-3 w-24 shimmer rounded" />
                        <div class="h-3 w-48 shimmer rounded" />
                    </div>
                </div>
            </template>

            <PostCard
                v-for="post in feed.items"
                :key="post.id"
                v-reveal-on-scroll
                class="reveal-on-scroll"
                :data-created-at="post.created_at"
                :data-taken-at="post.taken_at ?? undefined"
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
                <span class="flex items-center gap-1">
                    <span
                        class="dot dot-1 size-1.5 rounded-full bg-action"
                    ></span>
                    <span
                        class="dot dot-2 size-1.5 rounded-full bg-accent"
                    ></span>
                    <span
                        class="dot dot-3 size-1.5 rounded-full bg-sage-500"
                    ></span>
                </span>
                {{ t('Loading more...') }}
            </div>

            <div ref="sentinelRef" class="h-1" />

            <RouterLink
                v-if="!feed.loading && feed.items.length === 0"
                :to="{ name: 'spa.posts.create' }"
                class="relative flex min-h-[calc(100dvh-15rem-var(--inset-top))] flex-col items-center justify-center overflow-hidden px-8 py-12"
            >
                <div
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-0"
                >
                    <div
                        class="absolute top-4 -left-16 size-56 rounded-full bg-sage-200/50 blur-3xl"
                    ></div>
                    <div
                        class="absolute -right-16 bottom-0 size-64 rounded-full bg-accent-soft/30 blur-3xl"
                    ></div>
                </div>
                <div
                    class="relative mb-5 flex size-24 rotate-[-6deg] items-center justify-center rounded-3xl bg-surface shadow-lg shadow-sand-900/5"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-12 bg-action"
                        :style="iconMaskStyle(cameraIcon)"
                    ></span>
                    <span
                        aria-hidden="true"
                        class="absolute -top-2 -right-2 flex size-8 rotate-12 items-center justify-center rounded-full bg-accent shadow-md"
                    >
                        <span
                            class="inline-block size-4 bg-surface"
                            :style="iconMaskStyle(starIcon)"
                        ></span>
                    </span>
                </div>
                <h3
                    class="relative font-display text-xl font-semibold text-ink"
                >
                    {{ t('Share your first moment') }}
                </h3>
                <p class="relative mt-2 text-center text-sand-600">
                    {{
                        t(
                            'Add the first photo and let grandparents and family follow along.',
                        )
                    }}
                </p>
            </RouterLink>
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

        <FeedLayoutChooser />
    </AppLayout>
</template>

<style scoped>
.dot-1 {
    animation-delay: 0s;
}
.dot-2 {
    animation-delay: 0.15s;
}
.dot-3 {
    animation-delay: 0.3s;
}
</style>
