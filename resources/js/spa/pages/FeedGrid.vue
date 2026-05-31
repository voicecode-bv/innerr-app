<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import FeedHeader from '@/spa/components/FeedHeader.vue';
import FeedLayoutChooser from '@/spa/components/FeedLayoutChooser.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import PostMasonry from '@/spa/components/PostMasonry.vue';
import { useInfiniteScroll } from '@/spa/composables/useInfiniteScroll';
import type { PaginatedResponse } from '@/spa/composables/useInfiniteScroll';
import { useProcessingPoll } from '@/spa/composables/useProcessingPoll';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useCirclesStore } from '@/spa/stores/circles';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { useNotificationsStore } from '@/spa/stores/notifications';
import cameraIcon from '../../../svg/doodle-icons/camera.svg';
import starIcon from '../../../svg/doodle-icons/star.svg';

const { t } = useTranslations();
const circlesStore = useCirclesStore();
const feedCache = useFeedCacheStore();
const notificationsStore = useNotificationsStore();
// Shares the list feed's cache key so toggling between views reuses the same
// items without a refetch.
const FEED_KEY = 'home';

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);
const sentinelRef = ref<HTMLElement | null>(null);

async function loadCircles(): Promise<void> {
    try {
        await circlesStore.ensureLoaded();
    } catch {
        // negeren — strip blijft leeg
    }
}

async function loadUnreadCount(): Promise<void> {
    try {
        await notificationsStore.refresh();
    } catch {
        // negeren — badge blijft op laatst bekende waarde
    }
}

const cached = feedCache.get<PostData>(FEED_KEY);

async function fetchFeed(page: number): Promise<PaginatedResponse<PostData>> {
    const response = await externalApi.get<PaginatedResponse<PostData>>(
        `/feed?page=${page}`,
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

useProcessingPoll(feed.items, () => feed.softRefresh());

onMounted(() => {
    if (cached && !feedCache.isFresh(FEED_KEY)) {
        void feed.softRefresh();
    }
});

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
        circlesStore.invalidate();
        feedCache.invalidate(FEED_KEY);
        notificationsStore.invalidate();
        await Promise.all([loadCircles(), loadUnreadCount(), feed.reset()]);
    },
    containerRef,
});

onMounted(loadCircles);
onMounted(loadUnreadCount);

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
    <AppLayout ref="layout" :show-header="false">
        <template #above>
            <FeedHeader layout="grid" />
        </template>

        <div class="mt-40 pb-24">
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
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
                            'Add a photo and share it with your family and friends.',
                        )
                    }}
                </p>
            </RouterLink>
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
