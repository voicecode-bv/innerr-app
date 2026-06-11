<script setup lang="ts">
import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    ref,
    useTemplateRef,
    watch,
} from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AnimatedCount from '@/components/AnimatedCount.vue';
import Chip from '@/components/Chip.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import CommentsSheet from '@/spa/components/CommentsSheet.vue';
import EditPostModal from '@/spa/components/EditPostModal.vue';
import LikesSheet from '@/spa/components/LikesSheet.vue';
import MediaCarousel from '@/spa/components/MediaCarousel.vue';
import type {
    PostFirstVisibleLiker,
    PostMediaItem,
} from '@/spa/components/PostCard.vue';
import VideoPlayer from '@/spa/components/VideoPlayer.vue';
import { stackedOverlayScaled } from '@/spa/composables/useBackgroundScale';
import { useProcessingPoll } from '@/spa/composables/useProcessingPoll';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useVideoFullscreen } from '@/spa/composables/useVideoFullscreen';
import { vPinchZoom } from '@/spa/directives/pinchZoom';
import { vRevealOnScroll } from '@/spa/directives/revealOnScroll';
import { externalApi } from '@/spa/http/externalApi';
import { haptics } from '@/spa/services/haptics';
import { closePostWithHeroTransition } from '@/spa/services/postHeroTransition';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { usePersonsStore } from '@/spa/stores/persons';
import { usePostCacheStore } from '@/spa/stores/postCache';
import { useServiceKeysStore } from '@/spa/stores/serviceKeys';
import { useTagsStore } from '@/spa/stores/tags';
import { BridgeCall, Dialog, Events, Off, On } from '@nativephp/mobile';
import calendarIcon from '../../../svg/doodle-icons/calendar.svg';
import downloadIcon from '../../../svg/doodle-icons/download.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import messageIcon from '../../../svg/doodle-icons/message.svg';
import pencilIcon from '../../../svg/doodle-icons/pencil-3.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

interface User {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
}

interface Circle {
    id: string;
    name: string;
    photo: string | null;
}

interface Tag {
    id: string;
    name: string;
}

interface Person {
    id: string;
    name: string;
    avatar_thumbnail?: string | null;
    user_id?: string | null;
    user_username?: string | null;
    birthdate?: string | null;
}

interface AvailableCircle extends Circle {
    members_count?: number;
    members_can_invite?: boolean;
    is_owner?: boolean;
}

interface AvailableTag {
    id: string;
    name: string;
    usage_count?: number;
}

interface AvailablePerson {
    id: string;
    name: string;
    avatar_thumbnail?: string | null;
    avatar?: string | null;
    user_id?: string | null;
}

interface Post {
    id: string;
    media_url: string;
    media_type: string;
    thumbnail_url: string | null;
    media_status: 'processing' | 'ready' | 'failed';
    media?: PostMediaItem[];
    caption: string | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    taken_at: string | null;
    user: User;
    is_liked: boolean;
    is_downloadable?: boolean;
    original_media_url?: string | null;
    likes_count: number;
    first_visible_liker?: PostFirstVisibleLiker | null;
    comments_count: number;
    circles?: Circle[];
    tags?: Tag[];
    persons?: Person[];
}

const { t, locale } = useTranslations();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const postId = computed(() => String(route.params.post));
const post = ref<Post | null>(null);
const isLoading = ref(true);
const isDeleting = ref(false);

// De detailpagina is een eigen full-screen overlay (fixed inset-0) met een
// eigen scroll-container, los van AppLayout's gedeelde <main>. Dat haalt de
// geneste scroll-context (en de WKWebView-quirks daarvan) weg en lost het
// scroll-probleem op.
const scrollRef = ref<HTMLElement | null>(null);

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

// Auto-refresh terwijl de post nog in `media_status='processing'` staat (bv.
// vers ge-uploade video die nog getranscodeerd wordt). Zodra de server status
// 'ready' meldt, switcht de UI van spinner+poster naar de echte VideoPlayer.
const postItems = computed(() => (post.value ? [post.value] : []));
useProcessingPoll(postItems, loadPost);

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: refresh,
    containerRef: scrollRef,
});

// Scroll-reset bij mount. Vue-router's `scrollBehavior` raakt onze eigen
// scroll-container niet, en WKWebView toont na een route-transitie soms een
// lege pagina tot er gescrold wordt — beide opgelost door direct, na nextTick
// en na een rAF-pass naar boven te resetten.
onMounted(() => {
    function resetScroll(): void {
        if (scrollRef.value) {
            scrollRef.value.scrollTop = 0;
        }
    }

    resetScroll();
    void nextTick(resetScroll);

    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
            resetScroll();
            requestAnimationFrame(resetScroll);
        });
    }
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
    if (!post.value || isUntaggingSelf.value) {
        return;
    }

    await Dialog.alert()
        .confirm(t('Remove tag'), t('Remove yourself from this post?'))
        .id('untag-self-confirm');
}

async function performUntagSelf(): Promise<void> {
    if (!post.value) {
        return;
    }

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

    if (!token || !hasLocation.value || !post.value) {
        return null;
    }

    const lng = post.value.longitude;
    const lat = post.value.latitude;
    const pin = `pin-l+373d8a(${lng},${lat})`;

    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},14/640x320@2x?access_token=${token}`;
});

const mapTarget = computed(() => {
    const firstCircle = post.value?.circles?.[0];

    return firstCircle
        ? { name: 'spa.circles.map', params: { circle: firstCircle.id } }
        : { name: 'spa.map' };
});

// Capture date shown in the details block. Falls back to the post creation
// date when EXIF taken_at is absent, matching how ageAt resolves the moment.
const formattedTakenAt = computed<string | null>(() => {
    const source = post.value?.taken_at ?? post.value?.created_at;

    if (!source) {
        return null;
    }

    const date = new Date(source);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleDateString(locale.value, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
});

const videoPlayerRef = ref<{ videoRef: HTMLVideoElement | null } | null>(null);
const videoRef = ref<HTMLVideoElement | undefined>(undefined);
watch(
    () => videoPlayerRef.value?.videoRef ?? null,
    (el) => {
        videoRef.value = el ?? undefined;
    },
);
const { isMuted, isFullscreen, toggleMute, toggleFullscreen } =
    useVideoFullscreen(videoRef);
const mediaLoaded = ref(false);

const carouselItems = computed(() =>
    (post.value?.media ?? []).map((m) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        thumbnail: m.thumbnail_url ?? null,
    })),
);
const hasMultipleMedia = computed(() => carouselItems.value.length > 1);
const activeMediaIndex = ref(0);

// Diepe link vanuit de profiel-grid: `?media=<index>` opent de post op de
// betreffende carousel-slide. Geclampt op het aantal geladen media-items;
// valt terug op 0 (cover) bij ontbrekende, ongeldige of out-of-range waarde.
function deepLinkedMediaIndex(): number {
    const raw = route.query.media;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = value != null ? Number.parseInt(String(value), 10) : NaN;

    if (!Number.isInteger(parsed) || parsed <= 0) {
        return 0;
    }

    const count = post.value?.media?.length ?? 0;

    return count > 0 ? Math.min(parsed, count - 1) : 0;
}

watch(
    () => post.value?.media_url,
    () => {
        mediaLoaded.value = false;
        activeMediaIndex.value = deepLinkedMediaIndex();
    },
);

const canDownload = computed(() => {
    if (!post.value) {
        return false;
    }

    if (
        post.value.media_type !== 'image' &&
        post.value.media_type !== 'video'
    ) {
        return false;
    }

    return post.value.is_downloadable === true;
});

const isDownloading = ref(false);

async function downloadMedia(): Promise<void> {
    if (!post.value || isDownloading.value) {
        return;
    }

    // Bij multi-photo posts downloaden we de slide die nu zichtbaar is — anders
    // kan de gebruiker de andere foto's nooit opslaan.
    const activeItem = post.value.media?.[activeMediaIndex.value];
    const url = activeItem
        ? (activeItem.original_url ?? activeItem.url)
        : (post.value.original_media_url ?? post.value.media_url);
    const itemType = activeItem ? activeItem.type : post.value.media_type;

    if (!url) {
        return;
    }

    const type = itemType === 'video' ? 'video' : 'image';

    isDownloading.value = true;

    try {
        const response = (await BridgeCall('Photos.Save', { url, type })) as
            | { status?: string; code?: string; message?: string }
            | undefined;

        if (response?.status === 'saved') {
            await Dialog.toast(
                type === 'video'
                    ? t('Video saved to your photos')
                    : t('Photo saved to your photos'),
            );

            return;
        }

        const code = response?.code ?? 'UNKNOWN_ERROR';
        const message =
            code === 'PERMISSION_DENIED'
                ? t('Allow photo library access in Settings to save media.')
                : t('Could not save to your photos. Please try again.');

        await Dialog.toast(message);
    } catch {
        await Dialog.toast(
            t('Could not save to your photos. Please try again.'),
        );
    } finally {
        isDownloading.value = false;
    }
}

// "X en N anderen vinden dit leuk" — first_visible_liker is de meest recente
// liker uit een gedeelde circle. Bij geen visible liker maar wel likes
// (alleen hidden) tonen we de placeholder-variant zonder naam.
const likesSummary = computed<{
    text: string;
    avatar: string | null;
} | null>(() => {
    if (!post.value) {
        return null;
    }

    const total = post.value.likes_count;

    if (total === 0) {
        return null;
    }

    const visible = post.value.first_visible_liker ?? null;
    const others = visible ? total - 1 : total;
    const isMe = visible !== null && visible.id === auth.user?.id;
    const displayName = isMe ? t('You') : (visible?.name ?? '');

    if (visible && others === 0) {
        return {
            text: isMe
                ? t('You like this')
                : t(':name likes this', { name: displayName }),
            avatar: visible.avatar,
        };
    }

    if (visible) {
        return {
            text:
                others === 1
                    ? t(':name and 1 other like this', { name: displayName })
                    : t(':name and :count others like this', {
                          name: displayName,
                          count: others,
                      }),
            avatar: visible.avatar,
        };
    }

    return {
        text:
            others === 1
                ? t('1 person likes this')
                : t(':count people like this', { count: others }),
        avatar: null,
    };
});

const isLikesSheetOpen = ref(false);
// Binnenkomst via een comment-push: de deep link draagt `?comment=<id>` mee
// (zie API PostCommented/CommentLiked). Open dan meteen het comments-sheet zodat
// de gebruiker direct bij de reacties uitkomt; de sheet laadt zelf de comments.
const isCommentsSheetOpen = ref(Boolean(route.query.comment));
const isEditModalOpen = ref(false);
const editAvailableCircles = ref<AvailableCircle[]>([]);
const editAvailableTags = ref<AvailableTag[]>([]);
const editAvailablePersons = ref<AvailablePerson[]>([]);

function openLikes(): void {
    isLikesSheetOpen.value = true;
}

async function toggleLike(): Promise<void> {
    if (!post.value || isOwner.value) {
        return;
    }

    const wasLiked = post.value.is_liked;
    post.value.is_liked = !wasLiked;
    post.value.likes_count += wasLiked ? -1 : 1;

    if (wasLiked) {
        haptics.impactLight();
    } else {
        haptics.impactMedium();
    }

    try {
        if (wasLiked) {
            await externalApi.delete(`/posts/${post.value.id}/like`);
        } else {
            await externalApi.post(`/posts/${post.value.id}/like`);
        }

        // Refresh shadow info zoals first_visible_liker — anders blijft de
        // "X en N anderen" regel hangen op de oude liker.
        postCache.invalidate(post.value.id);
    } catch {
        if (post.value) {
            post.value.is_liked = wasLiked;
            post.value.likes_count += wasLiked ? 1 : -1;
        }
    }
}

function openComments(): void {
    isCommentsSheetOpen.value = true;
}

// Double-tap on the media likes the post (never unlikes, Instagram style).
// Unlike the feed cards a single tap has no action here, so we only track the
// spacing between taps instead of delaying navigation. Mirrors PostCard.
const DOUBLE_TAP_MS = 260;
let lastTapAt = 0;

// Large heart that springs in over the media after a double-tap like.
const showHeartBurst = ref(false);

function onMediaTap(): void {
    if (isOwner.value) {
        return;
    }

    const now = Date.now();

    if (now - lastTapAt <= DOUBLE_TAP_MS) {
        lastTapAt = 0;
        likeFromDoubleTap();

        return;
    }

    lastTapAt = now;
}

function likeFromDoubleTap(): void {
    if (!post.value) {
        return;
    }

    showHeartBurst.value = true;

    if (post.value.is_liked) {
        // Already liked: acknowledge the gesture without toggling it off.
        haptics.impactLight();

        return;
    }

    void toggleLike();
}

const circlesStore = useCirclesStore();
const personsStore = usePersonsStore();
const tagsStore = useTagsStore();

async function openEditModal(): Promise<void> {
    if (!post.value) {
        return;
    }

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
    if (post.value) {
        post.value.comments_count += 1;
    }
}

function onCommentDeleted(): void {
    if (post.value) {
        post.value.comments_count = Math.max(0, post.value.comments_count - 1);
    }
}

async function deletePost(): Promise<void> {
    await Dialog.alert()
        .confirm(
            t('Delete post'),
            t('Are you sure you want to delete this post?'),
        )
        .id('delete-post-confirm');
}

function onPostDeleted(postId: string): void {
    postCache.invalidate(postId);
    useFeedCacheStore().clear();
    router.push({ name: 'spa.home' });
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

// router.back() resolves via popstate, not a promise; the hero morph needs to
// know when the route swap is done, so wait for the next afterEach.
function backAndWait(): Promise<void> {
    return new Promise((resolve) => {
        const off = router.afterEach(() => {
            off();
            resolve();
        });
        router.back();
    });
}

function goBack(): void {
    const navigate =
        window.history.length > 1
            ? backAndWait
            : () => router.push({ name: 'spa.home' });

    void closePostWithHeroTransition(post.value?.id ?? null, navigate);
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
    if (!birthdate) {
        return null;
    }

    const birth = new Date(birthdate);
    const at = new Date(atDateString);

    if (isNaN(birth.getTime()) || isNaN(at.getTime()) || at < birth) {
        return null;
    }

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

    if (seconds < 60) {
        return t('just now');
    }

    if (seconds < 3600) {
        return t(':count min ago', { count: Math.floor(seconds / 60) });
    }

    if (seconds < 86400) {
        return t(':count hours ago', { count: Math.floor(seconds / 3600) });
    }

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
        if (route.name !== 'spa.posts.show') {
            return;
        }

        // De overlay blijft bij post→post gemount, dus reset de scroll zelf.
        if (scrollRef.value) {
            scrollRef.value.scrollTop = 0;
        }

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
    <div
        ref="scrollRef"
        class="fixed inset-0 z-120 overflow-y-auto overscroll-contain bg-surface pt-[var(--inset-top,0px)] transition-[scale,filter,border-radius] duration-300 ease-spring-soft"
        :class="
            stackedOverlayScaled ? 'scale-[0.96] rounded-2xl brightness-90' : ''
        "
        style="transform: translate3d(0, 0, 0); will-change: transform"
    >
        <div class="pb-[var(--inset-bottom,0px)]">
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div v-if="isLoading && !post" class="-mt-[var(--inset-top,0px)]">
                <div class="aspect-square w-full shimmer" />
                <div class="flex items-center gap-3 bg-surface px-4 py-3">
                    <div class="size-10 shimmer rounded-full" />
                    <div class="space-y-2">
                        <div class="h-3 w-32 shimmer rounded" />
                        <div class="h-2 w-20 shimmer rounded" />
                    </div>
                </div>
                <div class="space-y-2 px-4 py-3">
                    <div class="h-3 w-24 shimmer rounded" />
                    <div class="h-3 w-48 shimmer rounded" />
                </div>
            </div>

            <div
                v-if="post"
                v-reveal-on-scroll
                class="reveal-on-scroll -mt-[var(--inset-top,0px)]"
            >
                <div
                    :class="[
                        isFullscreen
                            ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
                            : 'relative aspect-square overflow-hidden bg-sand-100',
                    ]"
                    :style="
                        isFullscreen
                            ? undefined
                            : { viewTransitionName: 'post-hero' }
                    "
                    @click="onMediaTap"
                >
                    <!-- Back button overlaid on the media; the overlay has no
                         header so the media sits edge-to-edge at the top. -->
                    <button
                        v-if="!isFullscreen"
                        type="button"
                        class="hit-slop absolute top-[calc(var(--inset-top,0px)+0.75rem)] left-3 z-30 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                        :aria-label="t('Back')"
                        @click.stop="goBack"
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

                    <div
                        v-if="showHeartBurst && !isFullscreen"
                        class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                    >
                        <span
                            aria-hidden="true"
                            class="heart-burst inline-block size-24 bg-white drop-shadow-lg"
                            :style="iconMaskStyle(heartFilledIcon)"
                            @animationend="showHeartBurst = false"
                        ></span>
                    </div>

                    <MediaCarousel
                        v-if="hasMultipleMedia && !isFullscreen"
                        :items="carouselItems"
                        :active-index="activeMediaIndex"
                        indicator-class="bottom-12"
                        @update:active-index="activeMediaIndex = $event"
                    />

                    <!-- Stays mounted while the photo fades in on top, so the
                         hero never flashes the bare background. Once loaded the
                         shimmer swaps to a static background to stop animating. -->
                    <div
                        v-if="
                            !hasMultipleMedia &&
                            post.media_type === 'image' &&
                            !isFullscreen
                        "
                        class="absolute inset-0"
                        :class="mediaLoaded ? 'bg-surface' : 'shimmer'"
                    />
                    <img
                        v-if="!hasMultipleMedia && post.media_type === 'image'"
                        v-pinch-zoom
                        :src="post.media_url"
                        :alt="post.caption ?? t('Photo')"
                        :class="[
                            isFullscreen
                                ? 'max-h-full max-w-full object-contain'
                                : 'size-full object-cover',
                            mediaLoaded ? 'opacity-100' : 'opacity-0',
                            'relative transition-opacity duration-300',
                        ]"
                        decoding="async"
                        @load="mediaLoaded = true"
                    />
                    <VideoPlayer
                        v-else-if="
                            post.media_type === 'video' &&
                            post.media_status === 'ready'
                        "
                        ref="videoPlayerRef"
                        v-pinch-zoom
                        :src="post.media_url"
                        :poster="post.thumbnail_url"
                        :class="
                            isFullscreen
                                ? 'max-h-full max-w-full object-contain'
                                : 'size-full object-cover'
                        "
                        muted
                        autoplay
                        loop
                        preload="metadata"
                    />
                    <template v-else-if="post.media_type === 'video'">
                        <img
                            v-if="post.thumbnail_url"
                            :src="post.thumbnail_url"
                            :alt="post.caption ?? t('Moment')"
                            :class="
                                isFullscreen
                                    ? 'max-h-full max-w-full object-contain'
                                    : 'size-full object-cover'
                            "
                        />
                        <div
                            class="absolute inset-0 flex items-center justify-center bg-black/35 px-6"
                        >
                            <div
                                class="flex max-w-xs flex-col items-center gap-3 text-center"
                            >
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
                                <div class="flex flex-col gap-1">
                                    <span class="font-semibold text-white">{{
                                        t('Processing your video')
                                    }}</span>
                                    <span class="text-white/85">{{
                                        t(
                                            'It will appear in your feed automatically when ready.',
                                        )
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </template>

                    <button
                        v-if="
                            canDownload &&
                            post.media_type === 'image' &&
                            !isFullscreen
                        "
                        type="button"
                        class="absolute top-[calc(var(--inset-top,0px)+0.75rem)] right-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm disabled:opacity-60"
                        :aria-label="t('Save to photos')"
                        :disabled="isDownloading"
                        @click.stop="downloadMedia"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-4 bg-current"
                            :style="iconMaskStyle(downloadIcon)"
                        ></span>
                    </button>

                    <div
                        v-if="
                            post.media_type === 'video' &&
                            post.media_status === 'ready'
                        "
                        :class="[
                            'absolute right-3 z-20 flex gap-2',
                            isFullscreen
                                ? 'top-[calc(env(safe-area-inset-top)+1.5rem)]'
                                : 'top-[calc(var(--inset-top,0px)+0.75rem)]',
                        ]"
                    >
                        <button
                            v-if="canDownload && !isFullscreen"
                            type="button"
                            class="flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm disabled:opacity-60"
                            :aria-label="t('Save to photos')"
                            :disabled="isDownloading"
                            @click.stop="downloadMedia"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-4 bg-current"
                                :style="iconMaskStyle(downloadIcon)"
                            ></span>
                        </button>
                        <button
                            class="flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                            @click.stop="toggleMute"
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
                            @click.stop="toggleFullscreen"
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
                        v-if="!isFullscreen"
                        class="absolute inset-x-0 bottom-0 z-10 flex items-center gap-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-12 pb-3"
                        @click.stop
                    >
                        <div class="flex items-center gap-1">
                            <button
                                v-if="!isOwner"
                                class="flex"
                                :aria-label="
                                    post.is_liked ? t('Unlike') : t('Like')
                                "
                                @click="toggleLike"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-6 drop-shadow"
                                    :class="
                                        post.is_liked
                                            ? 'bg-brand-orange'
                                            : 'bg-surface dark:bg-ink'
                                    "
                                    :style="
                                        iconMaskStyle(
                                            post.is_liked
                                                ? heartFilledIcon
                                                : heartIcon,
                                        )
                                    "
                                ></span>
                            </button>
                            <button
                                v-else
                                class="flex"
                                :aria-label="t('Show likes')"
                                @click="openLikes"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-6 bg-surface drop-shadow dark:bg-ink"
                                    :style="iconMaskStyle(heartIcon)"
                                ></span>
                            </button>
                            <AnimatedCount
                                v-if="post.likes_count > 0"
                                :value="post.likes_count"
                                class="text-white drop-shadow"
                            />
                        </div>
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
                            <AnimatedCount
                                v-if="post.comments_count > 0"
                                :value="post.comments_count"
                            />
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
                        <button
                            v-if="isOwner"
                            class="flex items-center text-white drop-shadow disabled:opacity-50"
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
                                class="size-6"
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
                                class="size-6 animate-spin"
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
                        <span class="ml-auto text-white/80 drop-shadow">{{
                            timeAgo(post.created_at)
                        }}</span>
                    </div>
                </div>

                <div class="flex items-center gap-3 bg-sand px-4 pt-3 pb-2">
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
                            class="avatar-ring size-10 rounded-full object-cover"
                        />
                    </RouterLink>
                    <div class="flex-1">
                        <RouterLink
                            :to="{
                                name: 'spa.profiles.show',
                                params: { username: post.user.username },
                            }"
                            class="font-semibold text-ink"
                        >
                            {{ post.user.name }}
                        </RouterLink>
                    </div>
                </div>

                <div v-if="post.caption" class="bg-sand px-4 pb-3">
                    <p class="leading-relaxed whitespace-pre-line text-ink">
                        {{ post.caption }}
                    </p>
                </div>

                <button
                    v-if="likesSummary"
                    type="button"
                    class="mt-2 flex w-full items-center gap-2 bg-sand px-4 py-2 text-left text-ink active:bg-sand-100/40"
                    @click="openLikes"
                >
                    <img
                        v-if="likesSummary.avatar"
                        :src="likesSummary.avatar"
                        alt=""
                        class="avatar-ring size-6 shrink-0 rounded-full object-cover"
                    />
                    <span
                        v-else
                        aria-hidden="true"
                        class="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-ink"
                    >
                        <span
                            class="inline-block size-3.5 bg-current"
                            :style="iconMaskStyle(userIcon)"
                        ></span>
                    </span>
                    <span class="min-w-0 truncate text-ink-muted">
                        {{ likesSummary.text }}
                    </span>
                </button>

                <div class="space-y-5 bg-sand px-4 pt-5 pb-2">
                    <section
                        v-if="(post.circles ?? []).length > 0"
                        class="space-y-3"
                    >
                        <h3 class="font-semibold text-brand-blue dark:text-ink">
                            {{ t('Circles') }}
                        </h3>
                        <div class="flex flex-wrap gap-2">
                            <Chip
                                v-for="circle in post.circles"
                                :key="circle.id"
                                :label="circle.name"
                                :photo="circle.photo"
                                :icon-url="userIcon"
                                :to="{
                                    name: 'spa.circles.show',
                                    params: { circle: circle.id },
                                }"
                            />
                        </div>
                    </section>

                    <section
                        v-if="(post.persons ?? []).length > 0"
                        class="space-y-3"
                    >
                        <h3 class="font-semibold text-brand-blue dark:text-ink">
                            {{ t('Persons') }}
                        </h3>
                        <div class="flex flex-wrap gap-2">
                            <template
                                v-for="person in post.persons"
                                :key="person.id"
                            >
                                <div
                                    v-if="person.user_id === auth.user?.id"
                                    class="inline-flex items-center gap-1"
                                >
                                    <Chip
                                        :label="person.name"
                                        :photo="person.avatar_thumbnail"
                                        :initial="person.name.charAt(0)"
                                    >
                                        <template
                                            v-if="
                                                ageAt(
                                                    person.birthdate,
                                                    post.taken_at ??
                                                        post.created_at,
                                                )
                                            "
                                            #meta
                                        >
                                            <span
                                                class="font-normal text-ink-muted"
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
                                        </template>
                                    </Chip>
                                    <button
                                        type="button"
                                        class="flex size-7 items-center justify-center rounded-full bg-surface text-ink-muted shadow-sm ring-1 ring-sand-100 transition-colors hover:bg-destructive-soft hover:text-destructive-ink disabled:opacity-50"
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
                                </div>
                                <Chip
                                    v-else
                                    :label="person.name"
                                    :photo="person.avatar_thumbnail"
                                    :initial="person.name.charAt(0)"
                                    :to="
                                        person.user_username
                                            ? {
                                                  name: 'spa.profiles.show',
                                                  params: {
                                                      username:
                                                          person.user_username,
                                                  },
                                              }
                                            : {
                                                  name: 'spa.timeline',
                                                  params: {
                                                      person: person.id,
                                                  },
                                              }
                                    "
                                >
                                    <template
                                        v-if="
                                            ageAt(
                                                person.birthdate,
                                                post.taken_at ??
                                                    post.created_at,
                                            )
                                        "
                                        #meta
                                    >
                                        <span
                                            class="font-normal text-ink-muted"
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
                                    </template>
                                </Chip>
                            </template>
                        </div>
                    </section>

                    <section
                        v-if="(post.tags ?? []).length > 0"
                        class="space-y-3"
                    >
                        <h3 class="font-semibold text-brand-blue dark:text-ink">
                            {{ t('Tags') }}
                        </h3>
                        <div class="flex flex-wrap gap-2">
                            <Chip
                                v-for="tag in post.tags"
                                :key="tag.id"
                                :label="tag.name"
                            />
                        </div>
                    </section>

                    <section v-if="formattedTakenAt" class="space-y-3">
                        <h3 class="font-semibold text-brand-blue dark:text-ink">
                            {{ t('Date') }}
                        </h3>
                        <div class="flex items-center gap-2 text-ink">
                            <span
                                aria-hidden="true"
                                class="inline-block size-5 bg-ink-muted"
                                :style="iconMaskStyle(calendarIcon)"
                            ></span>
                            <span class="first-letter:uppercase">{{
                                formattedTakenAt
                            }}</span>
                        </div>
                    </section>

                    <section class="space-y-3">
                        <h3 class="font-semibold text-brand-blue dark:text-ink">
                            {{ t('Location') }}
                        </h3>
                        <RouterLink
                            v-if="staticMapUrl"
                            :to="mapTarget"
                            class="relative block aspect-[2/1] w-full overflow-hidden rounded-2xl bg-sand-100 shadow-sm ring-1 ring-sand-100"
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

                        <div
                            v-else
                            class="flex aspect-[2/1] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-sand-100 text-ink-muted ring-1 ring-sand-100 dark:bg-surface"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="size-7 opacity-60"
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
                            <p>{{ t('No location set') }}</p>
                        </div>
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
            :location="post.location"
            :latitude="post.latitude"
            :longitude="post.longitude"
            :circles="post.circles ?? []"
            :available-circles="editAvailableCircles"
            :tags="post.tags ?? []"
            :persons="post.persons ?? []"
            :available-tags="editAvailableTags"
            :available-persons="editAvailablePersons"
            @update:open="isEditModalOpen = $event"
            @updated="loadPost"
            @deleted="onPostDeleted"
        />
    </div>
</template>
