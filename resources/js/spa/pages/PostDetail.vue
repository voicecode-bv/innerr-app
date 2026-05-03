<script setup lang="ts">
import { Dialog, Events, Off, On } from '@nativephp/mobile';
import {
    computed,
    onMounted,
    onUnmounted,
    ref,
    useTemplateRef,
    watch,
} from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import CommentsSheet from '@/spa/components/CommentsSheet.vue';
import EditPostModal from '@/spa/components/EditPostModal.vue';
import LikesSheet from '@/spa/components/LikesSheet.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useVideoFullscreen } from '@/spa/composables/useVideoFullscreen';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
import { usePersonsStore } from '@/spa/stores/persons';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { usePostCacheStore } from '@/spa/stores/postCache';
import { useTagsStore } from '@/spa/stores/tags';
import { useServiceKeysStore } from '@/spa/stores/serviceKeys';
import { externalApi } from '@/spa/http/externalApi';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import messageIcon from '../../../svg/doodle-icons/message.svg';
import pencilIcon from '../../../svg/doodle-icons/pencil-3.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

interface User {
    id: number;
    name: string;
    username: string;
    avatar: string | null;
}

interface Circle {
    id: number;
    name: string;
    photo: string | null;
}

interface Tag {
    id: number;
    name: string;
}

interface Person {
    id: number;
    name: string;
    avatar_thumbnail?: string | null;
    user_id?: number | null;
    user_username?: string | null;
    birthdate?: string | null;
}

interface AvailableCircle extends Circle {
    members_count?: number;
    members_can_invite?: boolean;
    is_owner?: boolean;
}

interface AvailableTag {
    id: number;
    name: string;
    usage_count?: number;
}

interface AvailablePerson {
    id: number;
    name: string;
    avatar_thumbnail?: string | null;
    avatar?: string | null;
    user_id?: number | null;
}

interface Post {
    id: number;
    media_url: string;
    media_type: string;
    thumbnail_url: string | null;
    media_status: 'processing' | 'ready' | 'failed';
    caption: string | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    taken_at: string | null;
    user: User;
    is_liked: boolean;
    likes_count: number;
    comments_count: number;
    circles?: Circle[];
    tags?: Tag[];
    persons?: Person[];
}

const { t } = useTranslations();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const postId = computed(() => Number(route.params.post));
const post = ref<Post | null>(null);
const isLoading = ref(true);
const isDeleting = ref(false);

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

const commentsSheetRef = useTemplateRef<{ reload: () => Promise<void> }>(
    'commentsSheet',
);

const postCache = usePostCacheStore();

function seedPostFromCache(): boolean {
    const cached = postCache.get<Post>(postId.value);
    if (cached) {
        post.value = cached;
        return true;
    }
    return false;
}

async function loadPost(): Promise<void> {
    try {
        const data = await externalApi.get<{ data: Post }>(
            `/posts/${postId.value}`,
        );
        post.value = data.data;
        postCache.set(postId.value, data.data);
    } catch {
        router.push({ name: 'spa.home' });
    }
}

async function refresh(): Promise<void> {
    await Promise.all([
        loadPost(),
        commentsSheetRef.value?.reload() ?? Promise.resolve(),
    ]);
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: refresh,
    containerRef,
});

onMounted(async () => {
    // Stale-while-revalidate: render direct vanuit cache, fetch op de achtergrond.
    const seeded = seedPostFromCache();
    isLoading.value = !seeded;
    await refresh();
    isLoading.value = false;
});

const isOwner = computed(() => post.value?.user.id === auth.user?.id);

const isUntaggingSelf = ref(false);

async function untagSelf(): Promise<void> {
    if (!post.value || isUntaggingSelf.value) return;
    await Dialog.alert()
        .confirm(t('Remove tag'), t('Remove yourself from this post?'))
        .id('untag-self-confirm');
}

async function performUntagSelf(): Promise<void> {
    if (!post.value) return;
    isUntaggingSelf.value = true;
    const postId = post.value.id;
    try {
        const response = await externalApi.delete<{ data: Post }>(
            `/posts/${postId}/tagged-self`,
        );
        post.value = response.data;
        postCache.set(postId, response.data);
        // Feed-caches kunnen nog de oude tag-lijst tonen — invalideren zodat
        // ze bij volgende bezoek opnieuw fetchen.
        useFeedCacheStore().clear();
    } catch {
        // ignore — gebruiker blijft op de post staan
    } finally {
        isUntaggingSelf.value = false;
    }
}
const serviceKeys = useServiceKeysStore();

const hasLocation = computed(
    () =>
        post.value?.latitude !== null &&
        post.value?.latitude !== undefined &&
        post.value?.longitude !== null &&
        post.value?.longitude !== undefined,
);

const staticMapUrl = computed<string | null>(() => {
    const token = serviceKeys.mapboxToken;
    if (!token || !hasLocation.value || !post.value) return null;
    const lng = post.value.longitude;
    const lat = post.value.latitude;
    const pin = `pin-l+1d5f5c(${lng},${lat})`;
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},14/640x320@2x?access_token=${token}`;
});

const mapTarget = computed(() => {
    const firstCircle = post.value?.circles?.[0];
    return firstCircle
        ? { name: 'spa.circles.map', params: { circle: firstCircle.id } }
        : { name: 'spa.map' };
});

const videoRef = ref<HTMLVideoElement>();
const { isMuted, isFullscreen, toggleMute, toggleFullscreen } =
    useVideoFullscreen(videoRef);
const mediaLoaded = ref(false);

watch(
    () => post.value?.media_url,
    () => {
        mediaLoaded.value = false;
    },
);

const isLikesSheetOpen = ref(false);
const isCommentsSheetOpen = ref(false);
const isEditModalOpen = ref(false);
const editAvailableCircles = ref<AvailableCircle[]>([]);
const editAvailableTags = ref<AvailableTag[]>([]);
const editAvailablePersons = ref<AvailablePerson[]>([]);

function openLikes(): void {
    isLikesSheetOpen.value = true;
}

function openComments(): void {
    isCommentsSheetOpen.value = true;
}

const circlesStore = useCirclesStore();
const personsStore = usePersonsStore();
const tagsStore = useTagsStore();

async function openEditModal(): Promise<void> {
    if (!post.value) return;
    try {
        const [circles, tags, persons] = await Promise.all([
            circlesStore.ensureLoaded().catch(() => [] as AvailableCircle[]),
            tagsStore.ensureLoaded().catch(() => [] as AvailableTag[]),
            personsStore.ensureLoaded().catch(() => [] as AvailablePerson[]),
        ]);
        editAvailableCircles.value = circles as AvailableCircle[];
        editAvailableTags.value = tags as AvailableTag[];
        editAvailablePersons.value = persons as AvailablePerson[];
    } catch {
        // open anyway with empty available lists
    }
    isEditModalOpen.value = true;
}

function onCommentAdded(): void {
    if (post.value) post.value.comments_count += 1;
}

function onCommentDeleted(): void {
    if (post.value)
        post.value.comments_count = Math.max(0, post.value.comments_count - 1);
}

async function deletePost(): Promise<void> {
    await Dialog.alert()
        .confirm(
            t('Delete post'),
            t('Are you sure you want to delete this post?'),
        )
        .id('delete-post-confirm');
}

async function handleButtonPressed(payload: {
    index: number;
    id?: string | null;
}): Promise<void> {
    if (payload.id === 'delete-post-confirm' && payload.index === 1) {
        isDeleting.value = true;
        try {
            await externalApi.delete(`/posts/${postId.value}`);
            postCache.invalidate(postId.value);
            // Feed-caches zijn nu stale (post is weg) — wis 'm zodat de
            // volgende feed-bezoek opnieuw fetcht.
            useFeedCacheStore().clear();
            router.push({ name: 'spa.home' });
        } catch {
            // ignore — gebruiker blijft op de post staan
        } finally {
            isDeleting.value = false;
        }
        return;
    }

    if (payload.id === 'untag-self-confirm' && payload.index === 1) {
        await performUntagSelf();
    }
}

onMounted(() => On(Events.Alert.ButtonPressed, handleButtonPressed));
onUnmounted(() => Off(Events.Alert.ButtonPressed, handleButtonPressed));

function goBack(): void {
    if (window.history.length > 1) {
        router.back();
    } else {
        router.push({ name: 'spa.home' });
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

function ageAt(
    birthdate: string | null | undefined,
    atDateString: string,
): string | null {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const at = new Date(atDateString);
    if (isNaN(birth.getTime()) || isNaN(at.getTime()) || at < birth)
        return null;

    const totalDays = Math.floor((at.getTime() - birth.getTime()) / 86_400_000);

    if (totalDays < 7) {
        return t(totalDays === 1 ? ':count day' : ':count days', {
            count: totalDays,
        });
    }

    let years = at.getFullYear() - birth.getFullYear();
    let months = at.getMonth() - birth.getMonth();
    if (at.getDate() < birth.getDate()) {
        months -= 1;
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }

    if (years === 0 && months === 0) {
        const weeks = Math.floor(totalDays / 7);
        return t(weeks === 1 ? ':count week' : ':count weeks', {
            count: weeks,
        });
    }

    if (years === 0) {
        return t(months === 1 ? ':count month' : ':count months', {
            count: months,
        });
    }

    if (years < 5 && months > 0) {
        const yearPart = t(years === 1 ? ':count year' : ':count years', {
            count: years,
        });
        const monthPart = t(months === 1 ? ':count month' : ':count months', {
            count: months,
        });
        return `${yearPart} ${monthPart}`;
    }

    return t(years === 1 ? ':count year' : ':count years', { count: years });
}

function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return t('just now');
    if (seconds < 3600)
        return t(':count min ago', { count: Math.floor(seconds / 60) });
    if (seconds < 86400)
        return t(':count hours ago', { count: Math.floor(seconds / 3600) });
    if (seconds < 604800) {
        const days = Math.floor(seconds / 86400);
        return t(days === 1 ? ':count day ago' : ':count days ago', {
            count: days,
        });
    }
    if (seconds < 2592000) {
        const weeks = Math.floor(seconds / 604800);
        return t(weeks === 1 ? ':count week ago' : ':count weeks ago', {
            count: weeks,
        });
    }
    if (seconds < 31536000) {
        const months = Math.floor(seconds / 2592000);
        return t(months === 1 ? ':count month ago' : ':count months ago', {
            count: months,
        });
    }
    const years = Math.floor(seconds / 31536000);
    return t(years === 1 ? ':count year ago' : ':count years ago', {
        count: years,
    });
}

watch(
    () => route.params.post,
    () => {
        if (route.name !== 'spa.posts.show') return;
        post.value = null;
        isLikesSheetOpen.value = false;
        isCommentsSheetOpen.value = false;
        isEditModalOpen.value = false;
        editAvailableCircles.value = [];
        editAvailableTags.value = [];
        editAvailablePersons.value = [];
        isFullscreen.value = false;
        isMuted.value = true;
        mediaLoaded.value = false;
        const seeded = seedPostFromCache();
        isLoading.value = !seeded;
        refresh().finally(() => {
            isLoading.value = false;
        });
    },
);
</script>

<template>
    <AppLayout ref="layout" :title="t('Moment')">
        <template #header-left>
            <button
                class="flex items-center text-sand-700 dark:text-sand-300"
                @click="goBack"
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
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>
        </template>
        <template v-if="isOwner" #header-right>
            <button
                class="text-blush-500 disabled:opacity-50"
                :aria-label="t('Delete post')"
                :disabled="isDeleting"
                @click="deletePost"
            >
                <svg
                    v-if="!isDeleting"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                </svg>
                <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    class="size-5 animate-spin"
                >
                    <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-opacity="0.25"
                    />
                    <path
                        d="M22 12a10 10 0 0 1-10 10"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                    />
                </svg>
            </button>
        </template>

        <div class="mt-10 pb-32">
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div v-if="isLoading && !post" class="animate-pulse">
                <div
                    class="flex items-center gap-3 bg-white px-4 py-3 dark:bg-sand-900"
                >
                    <div
                        class="size-10 rounded-full bg-sand-200 dark:bg-sand-700"
                    />
                    <div class="space-y-2">
                        <div
                            class="h-3 w-32 rounded bg-sand-200 dark:bg-sand-700"
                        />
                        <div
                            class="h-2 w-20 rounded bg-sand-200 dark:bg-sand-700"
                        />
                    </div>
                </div>
                <div
                    class="aspect-square w-full bg-sand-200 dark:bg-sand-700"
                />
                <div class="space-y-2 px-4 py-3">
                    <div
                        class="h-3 w-24 rounded bg-sand-200 dark:bg-sand-700"
                    />
                    <div
                        class="h-3 w-48 rounded bg-sand-200 dark:bg-sand-700"
                    />
                </div>
            </div>

            <div v-if="post">
                <div
                    class="flex items-center gap-3 bg-white px-4 py-3 dark:bg-sand-900"
                >
                    <RouterLink
                        :to="{
                            name: 'spa.profiles.show',
                            params: { username: post.user.username },
                        }"
                    >
                        <img
                            :src="
                                post.user.avatar ??
                                `https://ui-avatars.com/api/?name=${post.user.name}&background=f0dcc6&color=5c3f24&size=64`
                            "
                            :alt="post.user.name"
                            class="size-10 rounded-full object-cover ring-2 ring-sand-200 dark:ring-sand-700"
                        />
                    </RouterLink>
                    <div class="flex-1">
                        <RouterLink
                            :to="{
                                name: 'spa.profiles.show',
                                params: { username: post.user.username },
                            }"
                            class="font-semibold text-sand-800 dark:text-sand-100"
                        >
                            {{ post.user.name }}
                        </RouterLink>
                        <p
                            v-if="post.location"
                            class="text-sand-500 dark:text-sand-400"
                        >
                            {{ post.location }}
                        </p>
                    </div>
                </div>

                <div
                    v-if="post.caption"
                    class="bg-white px-4 pb-3 dark:bg-sand-900"
                >
                    <p
                        class="leading-relaxed whitespace-pre-line text-sand-800 dark:text-sand-200"
                    >
                        {{ post.caption }}
                    </p>
                </div>

                <div
                    :class="[
                        isFullscreen
                            ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
                            : 'relative aspect-square w-full overflow-hidden bg-sand-100 dark:bg-sand-800',
                    ]"
                >
                    <div
                        v-if="
                            post.media_type === 'image' &&
                            !mediaLoaded &&
                            !isFullscreen
                        "
                        class="absolute inset-0 animate-pulse bg-sand-200 dark:bg-sand-700"
                    />
                    <img
                        v-if="post.media_type === 'image'"
                        :src="post.media_url"
                        :alt="post.caption ?? t('Photo')"
                        :class="[
                            isFullscreen
                                ? 'max-h-full max-w-full object-contain'
                                : 'size-full object-cover',
                            mediaLoaded ? 'opacity-100' : 'opacity-0',
                            'transition-opacity duration-300',
                        ]"
                        decoding="async"
                        @load="mediaLoaded = true"
                    />
                    <video
                        v-else-if="
                            post.media_type === 'video' &&
                            post.media_status === 'ready'
                        "
                        ref="videoRef"
                        :src="post.media_url"
                        :poster="post.thumbnail_url ?? undefined"
                        :class="
                            isFullscreen
                                ? 'max-h-full max-w-full object-contain'
                                : 'size-full object-cover'
                        "
                        playsinline
                        muted
                        autoplay
                        loop
                        preload="metadata"
                    />
                    <div
                        v-else-if="post.media_type === 'video'"
                        class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/20"
                    >
                        <span class="text-white">{{
                            t('Processing video...')
                        }}</span>
                    </div>

                    <div
                        v-if="
                            post.media_type === 'video' &&
                            post.media_status === 'ready'
                        "
                        :class="[
                            'absolute z-20 flex gap-2',
                            isFullscreen
                                ? 'top-[calc(env(safe-area-inset-top)+1.5rem)] right-3'
                                : 'top-3 left-3',
                        ]"
                    >
                        <button
                            class="flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                            @click="toggleMute"
                        >
                            <svg
                                v-if="isMuted"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="size-4"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
                                />
                            </svg>
                            <svg
                                v-else
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="size-4"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
                                />
                            </svg>
                        </button>
                        <button
                            class="flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                            @click="toggleFullscreen"
                        >
                            <svg
                                v-if="!isFullscreen"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="size-4"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                                />
                            </svg>
                            <svg
                                v-else
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="size-4"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
                                />
                            </svg>
                        </button>
                    </div>

                    <div
                        v-if="
                            !isFullscreen &&
                            post.circles &&
                            post.circles.length > 0
                        "
                        class="absolute top-3 right-3 z-10 flex max-w-[70%] flex-wrap justify-end gap-1.5"
                    >
                        <RouterLink
                            v-for="circle in post.circles"
                            :key="circle.id"
                            :to="{
                                name: 'spa.circles.show',
                                params: { circle: circle.id },
                            }"
                            class="flex items-center gap-1.5 rounded-full bg-black/50 py-0.5 pr-2.5 pl-0.5 backdrop-blur-sm"
                        >
                            <img
                                v-if="circle.photo"
                                :src="circle.photo"
                                :alt="circle.name"
                                class="size-5 rounded-full object-cover"
                            />
                            <div
                                v-else
                                class="flex size-5 items-center justify-center rounded-full bg-white/20"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-3 bg-white"
                                    :style="iconMaskStyle(userIcon)"
                                ></span>
                            </div>
                            <span class="max-w-32 truncate text-white">{{
                                circle.name
                            }}</span>
                        </RouterLink>
                    </div>

                    <div
                        v-if="!isFullscreen"
                        class="absolute inset-x-0 bottom-0 z-10 flex items-center gap-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-12 pb-3"
                    >
                        <button
                            class="flex items-center gap-1"
                            :aria-label="t('Show likes')"
                            @click="openLikes"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-6 drop-shadow"
                                :class="
                                    post.is_liked ? 'bg-blush-400' : 'bg-white'
                                "
                                :style="
                                    iconMaskStyle(
                                        post.is_liked
                                            ? heartFilledIcon
                                            : heartIcon,
                                    )
                                "
                            ></span>
                            <span
                                v-if="post.likes_count > 0"
                                class="text-white drop-shadow"
                                >{{ post.likes_count }}</span
                            >
                        </button>
                        <button
                            class="flex items-center gap-1 text-white drop-shadow"
                            :aria-label="t('Comments')"
                            @click="openComments"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-6 bg-current"
                                :style="iconMaskStyle(messageIcon)"
                            ></span>
                            <span v-if="post.comments_count > 0" class=" ">{{
                                post.comments_count
                            }}</span>
                        </button>
                        <button
                            v-if="isOwner"
                            class="flex items-center text-white drop-shadow"
                            :aria-label="t('Edit post')"
                            @click="openEditModal"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-6 bg-current"
                                :style="iconMaskStyle(pencilIcon)"
                            ></span>
                        </button>
                        <span class="ml-auto text-white/80 drop-shadow">{{
                            timeAgo(post.created_at)
                        }}</span>
                    </div>
                </div>

                <div
                    v-if="
                        (post.persons ?? []).length > 0 ||
                        (post.tags ?? []).length > 0 ||
                        staticMapUrl
                    "
                    class="space-y-5 bg-warmwhite px-4 pt-5 pb-2 dark:bg-sand-900"
                >
                    <section
                        v-if="(post.persons ?? []).length > 0"
                        class="space-y-3"
                    >
                        <h3
                            class="font-semibold tracking-[0.18em] text-sand-500 uppercase dark:text-sand-400"
                        >
                            {{ t('Persons') }}
                        </h3>
                        <div class="flex flex-wrap gap-2">
                            <template
                                v-for="person in post.persons"
                                :key="person.id"
                            >
                                <span
                                    v-if="person.user_id === auth.user?.id"
                                    class="inline-flex items-center gap-2 rounded-full bg-white py-1 pr-1 pl-1 font-semibold text-sand-800 shadow-sm ring-1 ring-sand-100 dark:bg-sand-800 dark:text-sand-100 dark:ring-sand-700/60"
                                >
                                    <img
                                        v-if="person.avatar_thumbnail"
                                        :src="person.avatar_thumbnail"
                                        :alt="person.name"
                                        class="size-7 rounded-full object-cover"
                                    />
                                    <span
                                        v-else
                                        class="flex size-7 items-center justify-center rounded-full bg-sage-100 text-teal dark:bg-sage-900/40"
                                    >
                                        <span
                                            class="font-display font-semibold uppercase"
                                            >{{ person.name.charAt(0) }}</span
                                        >
                                    </span>
                                    <span class="pl-1">
                                        {{ person.name }}
                                        <span
                                            v-if="
                                                ageAt(
                                                    person.birthdate,
                                                    post.taken_at ??
                                                        post.created_at,
                                                )
                                            "
                                            class="font-normal text-sand-500 dark:text-sand-400"
                                        >
                                            ·
                                            {{
                                                ageAt(
                                                    person.birthdate,
                                                    post.taken_at ??
                                                        post.created_at,
                                                )
                                            }}
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        class="flex size-6 items-center justify-center rounded-full bg-sand-100 text-sand-600 transition-colors hover:bg-blush-100 hover:text-blush-600 disabled:opacity-50 dark:bg-sand-700 dark:text-sand-300 dark:hover:bg-blush-900/40 dark:hover:text-blush-300"
                                        :aria-label="
                                            t('Remove yourself from this post')
                                        "
                                        :disabled="isUntaggingSelf"
                                        @click="untagSelf"
                                    >
                                        <svg
                                            v-if="!isUntaggingSelf"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke-width="2.25"
                                            stroke="currentColor"
                                            class="size-3.5"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                d="M6 18 18 6M6 6l12 12"
                                            />
                                        </svg>
                                        <svg
                                            v-else
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            class="size-3.5 animate-spin"
                                        >
                                            <circle
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                stroke-width="3"
                                                stroke-opacity="0.25"
                                            />
                                            <path
                                                d="M22 12a10 10 0 0 1-10 10"
                                                stroke="currentColor"
                                                stroke-width="3"
                                                stroke-linecap="round"
                                            />
                                        </svg>
                                    </button>
                                </span>
                                <component
                                    v-else
                                    :is="
                                        person.user_username
                                            ? RouterLink
                                            : 'span'
                                    "
                                    :to="
                                        person.user_username
                                            ? {
                                                  name: 'spa.profiles.show',
                                                  params: {
                                                      username:
                                                          person.user_username,
                                                  },
                                              }
                                            : undefined
                                    "
                                    class="inline-flex items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1 font-semibold text-sand-800 shadow-sm ring-1 ring-sand-100 dark:bg-sand-800 dark:text-sand-100 dark:ring-sand-700/60"
                                    :class="
                                        person.user_username
                                            ? 'transition-colors hover:bg-sand-50 dark:hover:bg-sand-700'
                                            : ''
                                    "
                                >
                                    <img
                                        v-if="person.avatar_thumbnail"
                                        :src="person.avatar_thumbnail"
                                        :alt="person.name"
                                        class="size-7 rounded-full object-cover"
                                    />
                                    <span
                                        v-else
                                        class="flex size-7 items-center justify-center rounded-full bg-sage-100 text-teal dark:bg-sage-900/40"
                                    >
                                        <span
                                            class="font-display font-semibold uppercase"
                                            >{{ person.name.charAt(0) }}</span
                                        >
                                    </span>
                                    {{ person.name }}
                                    <span
                                        v-if="
                                            ageAt(
                                                person.birthdate,
                                                post.taken_at ??
                                                    post.created_at,
                                            )
                                        "
                                        class="font-normal text-sand-500 dark:text-sand-400"
                                    >
                                        ·
                                        {{
                                            ageAt(
                                                person.birthdate,
                                                post.taken_at ??
                                                    post.created_at,
                                            )
                                        }}
                                    </span>
                                </component>
                            </template>
                        </div>
                    </section>

                    <section
                        v-if="(post.tags ?? []).length > 0"
                        class="space-y-3"
                    >
                        <h3
                            class="font-semibold tracking-[0.18em] text-sand-500 uppercase dark:text-sand-400"
                        >
                            {{ t('Tags') }}
                        </h3>
                        <div class="flex flex-wrap gap-2">
                            <span
                                v-for="tag in post.tags"
                                :key="tag.id"
                                class="rounded-full bg-linear-to-r from-sage-100 to-teal-muted/30 px-3.5 py-1.5 font-semibold text-teal ring-1 ring-teal/15 ring-inset dark:from-sage-900/40 dark:to-teal-muted/15 dark:text-sage-200 dark:ring-sage-700/40"
                            >
                                {{ tag.name }}
                            </span>
                        </div>
                    </section>

                    <section v-if="staticMapUrl" class="space-y-3">
                        <h3
                            class="font-semibold tracking-[0.18em] text-sand-500 uppercase dark:text-sand-400"
                        >
                            {{ t('Location') }}
                        </h3>
                        <RouterLink
                            :to="mapTarget"
                            class="relative block aspect-[2/1] w-full overflow-hidden rounded-2xl bg-sand-100 shadow-sm ring-1 ring-sand-100 dark:bg-sand-800 dark:ring-sand-700/60"
                            :aria-label="t('Open map')"
                        >
                            <img
                                :src="staticMapUrl"
                                :alt="post.location ?? t('Open map')"
                                class="size-full object-cover"
                                loading="lazy"
                                decoding="async"
                            />
                            <div
                                v-if="post.location"
                                class="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-4 pt-10 pb-3 text-white"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="2"
                                    stroke="currentColor"
                                    class="size-4 drop-shadow"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                                    />
                                </svg>
                                <span class="drop-shadow">{{
                                    post.location
                                }}</span>
                            </div>
                        </RouterLink>
                    </section>
                </div>
            </div>
        </div>

        <CommentsSheet
            v-if="post"
            ref="commentsSheet"
            :open="isCommentsSheetOpen"
            :post-id="post.id"
            :comments-count="post.comments_count"
            @update:open="isCommentsSheetOpen = $event"
            @comment-added="onCommentAdded"
            @comment-deleted="onCommentDeleted"
        />

        <LikesSheet
            v-if="post"
            :open="isLikesSheetOpen"
            :post-id="post.id"
            :initial-count="post.likes_count"
            @update:open="isLikesSheetOpen = $event"
        />

        <EditPostModal
            v-if="post && isOwner"
            :open="isEditModalOpen"
            :post-id="post.id"
            :caption="post.caption"
            :circles="post.circles ?? []"
            :available-circles="editAvailableCircles"
            :tags="post.tags ?? []"
            :persons="post.persons ?? []"
            :available-tags="editAvailableTags"
            :available-persons="editAvailablePersons"
            @update:open="isEditModalOpen = $event"
            @updated="loadPost"
        />
    </AppLayout>
</template>
