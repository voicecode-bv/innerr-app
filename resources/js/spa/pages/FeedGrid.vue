<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import FeedHeader from '@/spa/components/FeedHeader.vue';
import FeedLayoutChooser from '@/spa/components/FeedLayoutChooser.vue';
import GettingStartedCard from '@/spa/components/GettingStartedCard.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import PostMasonry from '@/spa/components/PostMasonry.vue';
import PushPermissionCard from '@/spa/components/PushPermissionCard.vue';
import UpdateAvailableCard from '@/spa/components/UpdateAvailableCard.vue';
import { useChildFeedQuery } from '@/spa/composables/useChildFeedQuery';
import { useFeedDateBar } from '@/spa/composables/useFeedDateBar';
import { useInfiniteScroll } from '@/spa/composables/useInfiniteScroll';
import type { PaginatedResponse } from '@/spa/composables/useInfiniteScroll';
import { useProcessingPoll } from '@/spa/composables/useProcessingPoll';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useChildFilterStore } from '@/spa/stores/childFilter';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { useNotificationsStore } from '@/spa/stores/notifications';

const { t } = useTranslations();
const feedCache = useFeedCacheStore();
const childFilter = useChildFilterStore();
const notificationsStore = useNotificationsStore();
const { childFeedQuery } = useChildFeedQuery();
// Shares the list feed's cache key so toggling between views reuses the same
// items without a refetch.
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
        // ignore — badge stays at the last known value
    }
}

const cached = feedCache.get<PostData>(FEED_KEY);

async function fetchFeed(page: number): Promise<PaginatedResponse<PostData>> {
    const response = await externalApi.get<PaginatedResponse<PostData>>(
        `/feed?${await childFeedQuery(page)}`,
    );

    if (page === 1) {
        feedCache.set(FEED_KEY, response.data, response.meta.last_page);
    }

    return response;
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

// Re-fetch when the child filter changes, then refresh the date bar (the post
// count may be unchanged, so the count watcher won't always fire).
watch(
    () => childFilter.selectedIds,
    async () => {
        feedCache.invalidate(FEED_KEY);
        await feed.reset();
        recompute();
    },
);

useProcessingPoll(feed.items, () => feed.softRefresh());

onMounted(() => {
    if (cached && !feedCache.isFresh(FEED_KEY)) {
        void feed.softRefresh();
    }
});

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
        feedCache.invalidate(FEED_KEY);
        notificationsStore.invalidate();
        // Fire-and-forget: the permission check is a native bridge call that
        // can stall, and its result never gates the feed content.
        void permissionCardRef.value?.refresh();
        await Promise.all([loadUnreadCount(), feed.reset()]);
    },
    containerRef,
});

onMounted(loadUnreadCount);

async function onPushPermissionChanged(): Promise<void> {
    // After the user has answered the native prompt — granted or denied — we
    // want to show a fresh feed without a visual jolt.
    feedCache.invalidate(FEED_KEY);
    await feed.softRefresh();
}
</script>

<template>
    <AppLayout ref="layout" :show-header="false" scroll-key="spa.home.grid">
        <template #above="{ headerElevated }">
            <FeedHeader layout="grid" :elevated="headerElevated" />
            <!-- Sticky date bar pinned just below the fixed header (its bottom
                 sits at inset-top + the feed's mt-36). Shows the month + year of
                 the timeline at the current scroll position. -->
            <div
                v-if="feed.items.length > 0"
                ref="dateBarRef"
                aria-hidden="true"
                :style="{ top: `${headerBottom}px` }"
                class="pointer-events-none fixed right-[var(--inset-right,0px)] left-[var(--inset-left,0px)] z-[60] flex h-8 items-center justify-center"
            >
                <span
                    class="rounded-full bg-surface/85 px-4 py-1 text-xs font-semibold tracking-widest text-ink-muted uppercase shadow-sm ring-1 ring-sand-200/80 backdrop-blur-md"
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

            <GettingStartedCard class="mx-4 mt-6" />

            <UpdateAvailableCard class="mx-4 mt-6" />

            <PushPermissionCard
                ref="permissionCard"
                class="mx-4 mt-6"
                dismissible
                @permission-changed="onPushPermissionChanged"
            />

            <PostMasonry
                class="pt-6"
                :posts="feed.items"
                :loading="feed.loading"
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
        </div>

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
