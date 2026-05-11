<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';
import CommentsSheet from '@/spa/components/CommentsSheet.vue';
import LikesSheet from '@/spa/components/LikesSheet.vue';
import PostCard, { type PostData } from '@/spa/components/PostCard.vue';
import PostDetailsSheet from '@/spa/components/PostDetailsSheet.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import {
    useInfiniteScroll,
    type PaginatedResponse,
} from '@/spa/composables/useInfiniteScroll';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { externalApi } from '@/spa/http/externalApi';
import { useCirclesStore } from '@/spa/stores/circles';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { useNotificationsStore } from '@/spa/stores/notifications';
import cameraIcon from '../../../svg/doodle-icons/camera.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import searchIcon from '../../../svg/doodle-icons/search.svg';
import starIcon from '../../../svg/doodle-icons/star.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const circlesStore = useCirclesStore();
const feedCache = useFeedCacheStore();
const notificationsStore = useNotificationsStore();
const FEED_KEY = 'home';

const unreadNotifications = computed(() => notificationsStore.unreadCount);
const unreadBadge = computed(() =>
    unreadNotifications.value > 99 ? '99+' : String(unreadNotifications.value),
);

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);
const sentinelRef = ref<HTMLElement | null>(null);

const circles = computed(() => circlesStore.items);

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

onMounted(() => {
    // Cache toonbaar maar verlopen → fetch op de achtergrond zonder lege flits.
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

const commentsPostId = ref<string | null>(null);
const isCommentsOpen = ref(false);

const likesPostId = ref<string | null>(null);
const isLikesOpen = ref(false);

const detailsPostId = ref<string | null>(null);
const isDetailsOpen = ref(false);

function openCommentsForPost(postId: string): void {
    commentsPostId.value = postId;
    isCommentsOpen.value = true;
}

function openLikesForPost(postId: string): void {
    likesPostId.value = postId;
    isLikesOpen.value = true;
}

function openDetailsForPost(postId: string): void {
    detailsPostId.value = postId;
    isDetailsOpen.value = true;
}

async function onPostUpdated(): Promise<void> {
    feedCache.invalidate(FEED_KEY);
    await feed.softRefresh();
}

function activeLikesCount(): number {
    if (likesPostId.value === null) return 0;

    const target = feed.items.find((p) => p.id === likesPostId.value);

    return target?.likes_count ?? 0;
}

function activeCommentsCount(): number {
    if (commentsPostId.value === null) return 0;

    const target = feed.items.find((p) => p.id === commentsPostId.value);

    return target?.comments_count ?? 0;
}

function bumpActivePostCommentsCount(delta: number): void {
    if (commentsPostId.value === null) return;

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
    <AppLayout ref="layout" :show-header="false">
        <template #above>
            <div
                class="fixed right-[var(--inset-right)] left-[var(--inset-left)] z-100 border-b border-dark-sand bg-sand pt-[var(--inset-top)]"
            >
                <div class="flex items-center justify-between px-4 pt-2">
                    <RouterLink
                        :to="{ name: 'spa.search' }"
                        :aria-label="t('Search people')"
                        class="flex size-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 bg-accent"
                            :style="iconMaskStyle(searchIcon)"
                        ></span>
                    </RouterLink>
                    <RouterLink
                        :to="{ name: 'spa.notifications' }"
                        :aria-label="
                            unreadNotifications > 0
                                ? t(':count unread notifications', {
                                      count: unreadNotifications,
                                  })
                                : t('Open notifications')
                        "
                        class="relative flex size-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6"
                            :class="
                                unreadNotifications > 0
                                    ? 'bg-brand-orange'
                                    : 'bg-accent'
                            "
                            :style="
                                iconMaskStyle(
                                    unreadNotifications > 0
                                        ? heartFilledIcon
                                        : heartIcon,
                                )
                            "
                        ></span>
                        <span
                            v-if="unreadNotifications > 0"
                            class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-display text-[10px] leading-none font-semibold text-white shadow-sm ring-2 ring-white"
                        >
                            {{ unreadBadge }}
                        </span>
                    </RouterLink>
                </div>
                <div
                    class="no-scrollbar flex gap-3 overflow-x-auto px-4 pt-1 pb-3"
                >
                    <RouterLink
                        :to="{ name: 'spa.circles.index' }"
                        class="group flex shrink-0 flex-col items-center gap-1.5"
                    >
                        <div
                            class="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-teal/50 transition-transform duration-500 group-hover:rotate-90"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                                stroke="currentColor"
                                class="size-6 text-accent"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M12 4.5v15m7.5-7.5h-15"
                                />
                            </svg>
                        </div>
                        <span class="text-sm font-medium text-teal">{{
                            t('Circles')
                        }}</span>
                    </RouterLink>

                    <template v-if="!circles">
                        <div
                            v-for="n in 4"
                            :key="n"
                            class="flex shrink-0 flex-col items-center gap-1.5"
                        >
                            <div
                                class="size-15 animate-pulse rounded-full bg-sand"
                            />
                            <div
                                class="h-3 w-12 animate-pulse rounded bg-sand"
                            />
                        </div>
                    </template>

                    <RouterLink
                        v-else
                        v-for="circle in circles"
                        :key="circle.id"
                        :to="{
                            name: 'spa.circles.feed',
                            params: { circle: circle.id },
                        }"
                        class="flex shrink-0 flex-col items-center gap-1.5"
                    >
                        <div class="circle-ring relative rounded-full p-0.5">
                            <div class="rounded-full bg-white p-0.5">
                                <img
                                    v-if="circle.photo"
                                    :src="circle.photo"
                                    :alt="circle.name"
                                    class="size-14 rounded-full object-cover"
                                />
                                <div
                                    v-else
                                    class="flex size-14 items-center justify-center rounded-full bg-sand-100"
                                >
                                    <span
                                        aria-hidden="true"
                                        class="inline-block size-7 bg-sand-600"
                                        :style="iconMaskStyle(userIcon)"
                                    ></span>
                                </div>
                            </div>
                        </div>
                        <span
                            class="max-w-16 truncate text-sm font-medium text-teal"
                            >{{ circle.name }}</span
                        >
                    </RouterLink>
                </div>
            </div>
        </template>

        <div class="mt-38 pb-24">
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <template v-if="feed.items.length === 0 && feed.loading">
                <div v-for="n in 3" :key="n" class="animate-pulse">
                    <div class="flex items-center gap-3 px-4 py-3">
                        <div class="size-10 rounded-full bg-sand" />
                        <div class="h-3 w-32 rounded bg-sand" />
                    </div>
                    <div class="aspect-square w-full bg-sand" />
                    <div class="space-y-2 px-4 py-3">
                        <div class="h-3 w-24 rounded bg-sand" />
                        <div class="h-3 w-48 rounded bg-sand" />
                    </div>
                </div>
            </template>

            <PostCard
                v-for="post in feed.items"
                :key="post.id"
                :post="post"
                @open-comments="openCommentsForPost"
                @open-likes="openLikesForPost"
                @open-details="openDetailsForPost"
                @post-updated="onPostUpdated"
            />

            <div
                v-if="feed.loading && feed.items.length > 0"
                class="flex items-center justify-center gap-2 py-6 text-sand-500"
            >
                <span class="flex items-center gap-1">
                    <span
                        class="dot dot-1 size-1.5 rounded-full bg-teal"
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
                    class="relative mb-5 flex size-24 rotate-[-6deg] items-center justify-center rounded-3xl bg-white shadow-lg shadow-sand-900/5"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-12 bg-teal"
                        :style="iconMaskStyle(cameraIcon)"
                    ></span>
                    <span
                        aria-hidden="true"
                        class="absolute -top-2 -right-2 flex size-8 rotate-12 items-center justify-center rounded-full bg-accent shadow-md"
                    >
                        <span
                            class="inline-block size-4 bg-white"
                            :style="iconMaskStyle(starIcon)"
                        ></span>
                    </span>
                </div>
                <h3
                    class="relative font-display text-xl font-semibold text-teal"
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

        <PostDetailsSheet
            v-if="detailsPostId !== null"
            :open="isDetailsOpen"
            :post-id="detailsPostId"
            @update:open="isDetailsOpen = $event"
        />
    </AppLayout>
</template>

<style scoped>
/* circle-ring is aliased to the global .avatar-ring utility (in app.css) */
.circle-ring {
    background: conic-gradient(
        from 0deg,
        var(--color-brand-blue),
        var(--color-brand-green),
        var(--color-brand-yellow),
        var(--color-brand-orange),
        var(--color-brand-blue)
    );
}

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
