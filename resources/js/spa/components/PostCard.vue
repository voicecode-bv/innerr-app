<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useVideoFullscreen } from '@/spa/composables/useVideoFullscreen';
import { useAuthStore } from '@/spa/stores/auth';
import { externalApi } from '@/spa/http/externalApi';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import messageIcon from '../../../svg/doodle-icons/message.svg';

export interface PostData {
    id: number;
    media_url: string;
    media_type: string;
    thumbnail_url: string | null;
    thumbnail_small_url: string | null;
    media_status: 'processing' | 'ready' | 'failed';
    caption: string | null;
    location: string | null;
    created_at: string;
    user: {
        id: number;
        name: string;
        username: string;
        avatar: string | null;
    };
    circles?: {
        id: number;
        name: string;
        photo: string | null;
    }[];
    is_liked: boolean;
    likes_count: number;
    comments_count: number;
}

const props = defineProps<{
    post: PostData;
}>();

const emit = defineEmits<{
    (e: 'openComments', postId: number): void;
    (e: 'openLikes', postId: number): void;
}>();

function openLikes(): void {
    emit('openLikes', props.post.id);
}

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();

const authUserId = computed(() => auth.user?.id ?? null);
const isLiked = ref(props.post.is_liked);
const likesCount = ref(props.post.likes_count);
const commentsCount = ref(props.post.comments_count);
const showFullCaption = ref(false);
const captionRef = ref<HTMLParagraphElement>();
const isCaptionOverflowing = ref(false);
const mediaLoaded = ref(false);
const videoRef = ref<HTMLVideoElement>();
const {
    isMuted,
    isFullscreen,
    toggleMute: toggleMuteRaw,
    toggleFullscreen: toggleFullscreenRaw,
} = useVideoFullscreen(videoRef);

function toggleMute(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    toggleMuteRaw();
}

function toggleFullscreen(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    toggleFullscreenRaw();
}

watch(
    () => props.post.media_url,
    () => {
        mediaLoaded.value = false;
    },
);

async function measureCaptionOverflow(): Promise<void> {
    await nextTick();
    const el = captionRef.value;
    if (!el || showFullCaption.value) return;
    isCaptionOverflowing.value = el.scrollHeight > el.clientHeight + 1;
}

onMounted(() => {
    measureCaptionOverflow();
});

watch(
    () => props.post.caption,
    () => {
        showFullCaption.value = false;
        isCaptionOverflowing.value = false;
        measureCaptionOverflow();
    },
);

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

function navigateToPost(): void {
    if (!isFullscreen.value) {
        router.push({
            name: 'spa.posts.show',
            params: { post: props.post.id },
        });
    }
}

async function toggleLike(): Promise<void> {
    const wasLiked = isLiked.value;
    isLiked.value = !wasLiked;
    likesCount.value += wasLiked ? -1 : 1;

    try {
        if (wasLiked) {
            await externalApi.delete(`/posts/${props.post.id}/like`);
        } else {
            await externalApi.post(`/posts/${props.post.id}/like`);
        }
    } catch {
        isLiked.value = wasLiked;
        likesCount.value += wasLiked ? 1 : -1;
    }
}

function openComments(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    emit('openComments', props.post.id);
}

watch(
    () => props.post.comments_count,
    (next) => {
        commentsCount.value = next;
    },
);

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
</script>

<template>
    <article class="bg-white dark:bg-sand-900">
        <div class="flex items-center gap-3 px-4 py-3">
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

        <div v-if="post.caption" class="px-4 pb-3">
            <p
                ref="captionRef"
                class="leading-relaxed whitespace-pre-line text-sand-800 dark:text-sand-200"
                :class="{ 'line-clamp-1': !showFullCaption }"
            >
                {{ post.caption }}
            </p>
            <button
                v-if="isCaptionOverflowing"
                class="mt-1 text-sand-500 dark:text-sand-400"
                @click="showFullCaption = !showFullCaption"
            >
                {{ showFullCaption ? t('less') : t('more') }}
            </button>
        </div>

        <div
            v-if="post.media_type === 'image'"
            class="relative aspect-square w-full overflow-hidden bg-sand-100 dark:bg-sand-800"
        >
            <button
                class="block size-full"
                type="button"
                @click="navigateToPost"
            >
                <div v-if="!mediaLoaded" class="absolute inset-0 shimmer" />
                <img
                    v-if="post.media_url"
                    :src="post.media_url"
                    :alt="post.caption ?? t('Photo')"
                    class="size-full object-cover transition-opacity duration-500"
                    :class="mediaLoaded ? 'opacity-100' : 'opacity-0'"
                    loading="lazy"
                    @load="mediaLoaded = true"
                />
                <div
                    v-if="post.media_status === 'processing' && !mediaLoaded"
                    class="absolute inset-0 flex items-center justify-center bg-black/15"
                >
                    <span
                        class="rounded-full bg-black/55 px-3 py-1.5 text-white"
                        >{{ t('Uploading...') }}</span
                    >
                </div>
            </button>
            <div
                v-if="post.circles && post.circles.length > 0"
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
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="size-3 text-white"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                            />
                        </svg>
                    </div>
                    <span class="text-white">{{ circle.name }}</span>
                </RouterLink>
            </div>
            <div
                class="absolute inset-x-0 bottom-0 z-10 flex items-center gap-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-12 pb-3"
            >
                <div class="flex items-center gap-1">
                    <button
                        v-if="post.user.id !== authUserId"
                        class="flex"
                        @click.stop="toggleLike"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 drop-shadow"
                            :class="isLiked ? 'bg-blush-400' : 'bg-white'"
                            :style="
                                iconMaskStyle(
                                    isLiked ? heartFilledIcon : heartIcon,
                                )
                            "
                        ></span>
                    </button>
                    <button
                        v-else
                        class="flex"
                        :aria-label="t('Show likes')"
                        @click.stop="openLikes"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 bg-white drop-shadow"
                            :style="iconMaskStyle(heartIcon)"
                        ></span>
                    </button>
                    <span
                        v-if="likesCount > 0"
                        class="text-white drop-shadow"
                        >{{ likesCount }}</span
                    >
                </div>
                <button
                    class="flex items-center gap-1 text-white drop-shadow"
                    @click.stop="openComments"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-6 bg-current"
                        :style="iconMaskStyle(messageIcon)"
                    ></span>
                    <span v-if="commentsCount > 0" class=" ">{{
                        commentsCount
                    }}</span>
                </button>
                <span class="ml-auto text-white/80 drop-shadow">{{
                    timeAgo(post.created_at)
                }}</span>
            </div>
        </div>

        <div v-else-if="post.media_type === 'video'">
            <div
                :class="[
                    isFullscreen
                        ? 'fixed inset-0 z-9999 flex items-center justify-center bg-black'
                        : 'relative aspect-square w-full overflow-hidden bg-sand-100 dark:bg-sand-800',
                ]"
                @click="navigateToPost"
            >
                <div
                    v-if="
                        post.media_status === 'ready' &&
                        !mediaLoaded &&
                        !isFullscreen
                    "
                    class="absolute inset-0 shimmer"
                />
                <video
                    v-if="post.media_status === 'ready'"
                    ref="videoRef"
                    :src="post.media_url"
                    :poster="post.thumbnail_url ?? undefined"
                    :class="[
                        isFullscreen
                            ? 'max-h-full max-w-full object-contain'
                            : 'size-full object-cover',
                        'transition-opacity duration-500',
                        mediaLoaded ? 'opacity-100' : 'opacity-0',
                    ]"
                    playsinline
                    muted
                    autoplay
                    loop
                    preload="metadata"
                    @loadeddata="mediaLoaded = true"
                />

                <div
                    v-if="post.media_status === 'ready'"
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

                <template v-else>
                    <img
                        v-if="post.thumbnail_url"
                        :src="post.thumbnail_url"
                        :alt="post.caption ?? t('Moment')"
                        class="size-full object-cover"
                    />
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-black/20"
                    >
                        <div class="flex flex-col items-center gap-2">
                            <svg
                                class="size-8 animate-spin text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                />
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                            <span class="text-white">{{
                                t('Processing video...')
                            }}</span>
                        </div>
                    </div>
                </template>

                <div
                    v-if="
                        !isFullscreen && post.circles && post.circles.length > 0
                    "
                    class="absolute top-3 right-3 z-10 flex max-w-[70%] flex-wrap justify-end gap-1.5"
                    @click.stop
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
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="size-3 text-white"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                                />
                            </svg>
                        </div>
                        <span class="text-white">{{ circle.name }}</span>
                    </RouterLink>
                </div>

                <div
                    v-if="!isFullscreen"
                    class="absolute inset-x-0 bottom-0 z-10 flex items-center gap-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-12 pb-3"
                    @click.stop
                >
                    <div class="flex items-center gap-1">
                        <button
                            v-if="post.user.id !== authUserId"
                            class="flex"
                            @click.stop="toggleLike"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-6 drop-shadow"
                                :class="isLiked ? 'bg-blush-400' : 'bg-white'"
                                :style="
                                    iconMaskStyle(
                                        isLiked ? heartFilledIcon : heartIcon,
                                    )
                                "
                            ></span>
                        </button>
                        <button
                            v-else
                            class="flex"
                            :aria-label="t('Show likes')"
                            @click.stop="openLikes"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-6 bg-white drop-shadow"
                                :style="iconMaskStyle(heartIcon)"
                            ></span>
                        </button>
                        <span
                            v-if="likesCount > 0"
                            class="text-white drop-shadow"
                            >{{ likesCount }}</span
                        >
                    </div>
                    <button
                        class="flex items-center gap-1 text-white drop-shadow"
                        @click.stop="openComments"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 bg-current"
                            :style="iconMaskStyle(messageIcon)"
                        ></span>
                        <span v-if="commentsCount > 0" class=" ">{{
                            commentsCount
                        }}</span>
                    </button>
                    <span class="ml-auto text-white/80 drop-shadow">{{
                        timeAgo(post.created_at)
                    }}</span>
                </div>
            </div>
        </div>

        <div
            v-else
            class="relative aspect-square w-full bg-sand-100 dark:bg-sand-800"
        >
            <button
                class="block size-full"
                type="button"
                @click="navigateToPost"
            >
                <div class="flex size-full items-center justify-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-12 text-sand-300 dark:text-sand-600"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"
                        />
                    </svg>
                </div>
            </button>
        </div>
    </article>
</template>
