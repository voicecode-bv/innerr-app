<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AnimatedCount from '@/components/AnimatedCount.vue';
import EditPostModal from '@/spa/components/EditPostModal.vue';
import MediaCarousel from '@/spa/components/MediaCarousel.vue';
import VideoPlayer from '@/spa/components/VideoPlayer.vue';
import { useRelativeTime } from '@/spa/composables/useRelativeTime';
import { useReviewPrompt } from '@/spa/composables/useReviewPrompt';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useVideoFullscreen } from '@/spa/composables/useVideoFullscreen';
import { vPinchZoom } from '@/spa/directives/pinchZoom';
import { externalApi } from '@/spa/http/externalApi';
import { haptics } from '@/spa/services/haptics';
import { openPostWithHeroTransition } from '@/spa/services/postHeroTransition';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
import { usePersonsStore } from '@/spa/stores/persons';
import { usePostCacheStore } from '@/spa/stores/postCache';
import { useTagsStore } from '@/spa/stores/tags';
import { BridgeCall, Dialog } from '@nativephp/mobile';
import downloadIcon from '../../../svg/doodle-icons/download.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import messageIcon from '../../../svg/doodle-icons/message.svg';
import pencilIcon from '../../../svg/doodle-icons/pencil-3.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

export interface PostMediaItem {
    id: string;
    url: string;
    original_url?: string | null;
    type: 'image' | 'video';
    status?: 'processing' | 'ready' | 'failed';
    thumbnail_url?: string | null;
    thumbnail_small_url?: string | null;
    width?: number | null;
    height?: number | null;
    sort_order?: number;
}

export interface PostFirstVisibleLiker {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
}

export interface PostData {
    id: string;
    /** 'media' for a regular photo/video post, 'quote' for a rendered quote. */
    type?: 'media' | 'quote';
    media_url: string;
    media_type: string;
    thumbnail_url: string | null;
    thumbnail_small_url: string | null;
    media_status: 'processing' | 'ready' | 'failed';
    width?: number | null;
    height?: number | null;
    media?: PostMediaItem[];
    caption: string | null;
    quote_text?: string | null;
    quote_author?: string | null;
    location: string | null;
    taken_at?: string | null;
    created_at: string;
    user: {
        id: string;
        name: string;
        username: string;
        avatar: string | null;
    };
    circles?: {
        id: string;
        name: string;
        photo: string | null;
    }[];
    is_liked: boolean;
    is_downloadable?: boolean;
    original_media_url?: string | null;
    likes_count: number;
    first_visible_liker?: PostFirstVisibleLiker | null;
    comments_count: number;
}

const props = defineProps<{
    post: PostData;
}>();

interface FullPostCircle {
    id: string;
    name: string;
    photo: string | null;
}

interface FullPostTag {
    id: string;
    name: string;
}

interface FullPostPerson {
    id: string;
    name: string;
    avatar_thumbnail?: string | null;
    user_id?: string | null;
}

interface FullPost {
    id: string;
    caption: string | null;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    circles?: FullPostCircle[];
    tags?: FullPostTag[];
    persons?: FullPostPerson[];
}

interface AvailableCircle extends FullPostCircle {
    members_count?: number;
    members_can_invite?: boolean;
    is_owner?: boolean;
}

interface AvailableTag extends FullPostTag {
    usage_count?: number;
}

interface AvailablePerson extends FullPostPerson {
    avatar?: string | null;
}

const emit = defineEmits<{
    (e: 'openComments', postId: string): void;
    (e: 'openLikes', postId: string): void;
    (e: 'postUpdated', postId: string): void;
    (e: 'postDeleted', postId: string): void;
}>();

function openLikes(): void {
    emit('openLikes', props.post.id);
}

const { t } = useTranslations();
const { timeAgo } = useRelativeTime();
const auth = useAuthStore();
const { maybeRequestReview } = useReviewPrompt();

const authUserId = computed(() => auth.user?.id ?? null);
const isOwner = computed(() => props.post.user.id === authUserId.value);
const canDownload = computed(() => {
    if (
        props.post.media_type !== 'image' &&
        props.post.media_type !== 'video'
    ) {
        return false;
    }

    return props.post.is_downloadable === true;
});

const isDownloading = ref(false);

async function downloadMedia(): Promise<void> {
    if (isDownloading.value) {
        return;
    }

    // For multi-photo posts we download the slide currently visible, not
    // always item 0 — otherwise the user can never save the other photos.
    const activeItem = props.post.media?.[activeMediaIndex.value];
    const url = activeItem
        ? (activeItem.original_url ?? activeItem.url)
        : (props.post.original_media_url ?? props.post.media_url);
    const itemType = activeItem ? activeItem.type : props.post.media_type;

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

const carouselItems = computed(() =>
    (props.post.media ?? []).map((m) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        thumbnail: m.thumbnail_url ?? null,
        thumbnailSmall: m.thumbnail_small_url ?? null,
    })),
);

const hasMultipleMedia = computed(() => carouselItems.value.length > 1);

const activeMediaIndex = ref(0);

const isLiked = ref(props.post.is_liked);
const likesCount = ref(props.post.likes_count);
const commentsCount = ref(props.post.comments_count);

// "X and N others like this" — first_visible_liker is the most recent liker
// from a shared circle. With no visible liker but likes present (hidden
// only) we show the placeholder variant.
const likesSummary = computed<{
    text: string;
    avatar: string | null;
} | null>(() => {
    const total = likesCount.value;

    if (total === 0) {
        return null;
    }

    const visible = props.post.first_visible_liker ?? null;
    const others = visible ? total - 1 : total;
    const isMe = visible !== null && visible.id === authUserId.value;
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

const circlesStore = useCirclesStore();
const personsStore = usePersonsStore();
const tagsStore = useTagsStore();
const postCache = usePostCacheStore();

const isEditModalOpen = ref(false);
const isLoadingEdit = ref(false);
const editPost = ref<FullPost | null>(null);
const editAvailableCircles = ref<AvailableCircle[]>([]);
const editAvailableTags = ref<AvailableTag[]>([]);
const editAvailablePersons = ref<AvailablePerson[]>([]);

async function openEditModal(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (isLoadingEdit.value) {
        return;
    }

    isLoadingEdit.value = true;

    try {
        const [postResponse, circles, tags, persons] = await Promise.all([
            externalApi.get<{ data: FullPost }>(`/posts/${props.post.id}`),
            circlesStore.ensureLoaded().catch(() => [] as AvailableCircle[]),
            tagsStore.ensureLoaded().catch(() => [] as AvailableTag[]),
            personsStore.ensureLoaded().catch(() => [] as AvailablePerson[]),
        ]);
        editPost.value = postResponse.data;
        postCache.set(props.post.id, postResponse.data);
        editAvailableCircles.value = circles as AvailableCircle[];
        editAvailableTags.value = tags as AvailableTag[];
        editAvailablePersons.value = persons as AvailablePerson[];
        isEditModalOpen.value = true;
    } catch {
        // ignore — the user simply stays on the feed
    } finally {
        isLoadingEdit.value = false;
    }
}

function onPostUpdated(): void {
    postCache.invalidate(props.post.id);
    emit('postUpdated', props.post.id);
}

function onPostDeleted(postId: string): void {
    postCache.invalidate(postId);
    emit('postDeleted', postId);
}
const showFullCaption = ref(false);
const captionRef = ref<HTMLParagraphElement>();
const isCaptionOverflowing = ref(false);
const mediaLoaded = ref(false);

// VideoPlayer wrapper exposes its underlying <video> via `videoRef`. We
// proxy that so useVideoFullscreen keeps its own reactive Ref and keeps
// re-evaluating as the user scrolls another post into view.
const videoPlayerRef = ref<{ videoRef: HTMLVideoElement | null } | null>(null);
const videoRef = ref<HTMLVideoElement | undefined>(undefined);
watch(
    () => videoPlayerRef.value?.videoRef ?? null,
    (el) => {
        videoRef.value = el ?? undefined;
    },
);
const {
    isMuted,
    isFullscreen,
    toggleMute: toggleMuteRaw,
    toggleFullscreen: toggleFullscreenRaw,
} = useVideoFullscreen(videoRef);

// Autoplay is gated on visibility, mirroring PostTile: an IntersectionObserver
// mounts the VideoPlayer only while the card's media is on (or near) screen
// and unmounts it on the way out, so a feed full of videos never keeps dozens
// of players buffering off-screen. Fullscreen keeps the player alive
// regardless: the in-DOM fullscreen fallback takes the container out of flow,
// which would otherwise report it as off-screen and kill playback.
const videoContainerRef = ref<HTMLElement | null>(null);
const isVideoInView = ref(false);
let videoObserver: IntersectionObserver | null = null;

const showVideo = computed(
    () =>
        props.post.media_status === 'ready' &&
        (isVideoInView.value || isFullscreen.value),
);

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

    if (!el || showFullCaption.value) {
        return;
    }

    isCaptionOverflowing.value = el.scrollHeight > el.clientHeight + 1;
}

onMounted(() => {
    measureCaptionOverflow();

    if (
        typeof IntersectionObserver === 'undefined' ||
        !videoContainerRef.value
    ) {
        // The ref only exists for single-video cards. Without observer support
        // the card stays on its poster rather than eagerly mounting a player.
        return;
    }

    videoObserver = new IntersectionObserver(
        (entries) => {
            isVideoInView.value = entries[0]?.isIntersecting ?? false;

            if (!isVideoInView.value && !isFullscreen.value) {
                // Reset so the freshly mounted player fades in over the poster
                // again when the card scrolls back into view.
                mediaLoaded.value = false;
            }
        },
        // Start buffering just before the card reaches the viewport so
        // playback begins without a visible gap, but keep the margin tight to
        // avoid mounting players that are still well off-screen.
        { rootMargin: '100px 0px', threshold: 0.1 },
    );

    videoObserver.observe(videoContainerRef.value);
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

const router = useRouter();

function openDetails(): void {
    if (isFullscreen.value) {
        return;
    }

    void openPostWithHeroTransition(props.post.id, () =>
        router.push({
            name: 'spa.posts.show',
            params: { post: props.post.id },
        }),
    );
}

// Transient flag driving the heart's pop animation; cleared on animationend
// so a follow-up like can replay it.
const likePop = ref(false);
// Large heart that springs in over the media after a double-tap like.
const showHeartBurst = ref(false);

async function toggleLike(): Promise<void> {
    const wasLiked = isLiked.value;
    isLiked.value = !wasLiked;
    likesCount.value += wasLiked ? -1 : 1;

    if (wasLiked) {
        haptics.impactLight();
    } else {
        haptics.impactMedium();
        likePop.value = true;
    }

    try {
        if (wasLiked) {
            await externalApi.delete(`/posts/${props.post.id}/like`);
        } else {
            await externalApi.post(`/posts/${props.post.id}/like`);
            // Only adding a like counts the activity toward the review
            // threshold.
            void maybeRequestReview(auth.user?.username);
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

// Double-tap on the media likes the post (never unlikes, Instagram style).
// Because a single tap opens the post detail, likeable posts wait one
// double-tap window before navigating; own posts keep the instant tap.
const DOUBLE_TAP_MS = 260;
let tapTimer: number | null = null;

function onMediaTap(): void {
    if (props.post.user.id === authUserId.value) {
        openDetails();

        return;
    }

    if (tapTimer !== null) {
        window.clearTimeout(tapTimer);
        tapTimer = null;
        likeFromDoubleTap();

        return;
    }

    tapTimer = window.setTimeout(() => {
        tapTimer = null;
        openDetails();
    }, DOUBLE_TAP_MS);
}

function likeFromDoubleTap(): void {
    showHeartBurst.value = true;

    if (isLiked.value) {
        // Already liked: acknowledge the gesture without toggling it off.
        haptics.impactLight();

        return;
    }

    void toggleLike();
}

onUnmounted(() => {
    videoObserver?.disconnect();
    videoObserver = null;

    if (tapTimer !== null) {
        window.clearTimeout(tapTimer);
        tapTimer = null;
    }
});

watch(
    () => props.post.comments_count,
    (next) => {
        commentsCount.value = next;
    },
);
</script>

<template>
    <!-- content-visibility lets the browser skip layout/paint (and drop
         decoded image bitmaps) for cards far off-screen, bounding memory on
         infinite feeds. Its paint containment makes the card the containing
         block for fixed descendants, which would clip the in-DOM fullscreen
         fallback to the card's box, so it is lifted while fullscreen. The
         edit sheet is unaffected: BottomSheet teleports to <body>. -->
    <article
        class="bg-sand pt-6"
        :class="
            isFullscreen
                ? ''
                : '[contain-intrinsic-size:auto_520px] [content-visibility:auto]'
        "
    >
        <div class="flex items-start gap-3 px-4 py-3">
            <RouterLink
                :to="{
                    name: 'spa.profiles.show',
                    params: { username: post.user.username },
                }"
                class="shrink-0"
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
            <div
                class="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-surface px-4 py-2.5 text-ink shadow-sm ring-1 ring-sand-100"
            >
                <div class="flex items-baseline justify-between gap-2">
                    <RouterLink
                        :to="{
                            name: 'spa.profiles.show',
                            params: { username: post.user.username },
                        }"
                        class="truncate font-semibold text-ink"
                    >
                        {{ post.user.name }}
                    </RouterLink>
                </div>
                <template v-if="post.caption">
                    <p
                        ref="captionRef"
                        class="mt-1 leading-relaxed whitespace-pre-line text-ink"
                        :class="{ 'line-clamp-2': !showFullCaption }"
                    >
                        {{ post.caption }}
                    </p>
                    <button
                        v-if="isCaptionOverflowing"
                        class="mt-1 text-sm text-ink-muted"
                        @click="showFullCaption = !showFullCaption"
                    >
                        {{ showFullCaption ? t('less') : t('more') }}
                    </button>
                </template>
            </div>
        </div>

        <div
            v-if="hasMultipleMedia"
            class="relative mx-3 aspect-square transform-gpu overflow-hidden rounded-2xl bg-sand"
            :data-post-media="post.id"
            @click="onMediaTap"
        >
            <MediaCarousel
                :items="carouselItems"
                :active-index="activeMediaIndex"
                indicator-class="bottom-12"
                @update:active-index="activeMediaIndex = $event"
            />

            <div
                v-if="showHeartBurst"
                class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
                <span
                    aria-hidden="true"
                    class="heart-burst inline-block size-24 bg-white drop-shadow-lg"
                    :style="iconMaskStyle(heartFilledIcon)"
                    @animationend="showHeartBurst = false"
                ></span>
            </div>

            <button
                v-if="canDownload"
                type="button"
                class="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm disabled:opacity-60"
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
                class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center gap-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-12 pb-3"
            >
                <div class="pointer-events-auto flex items-center gap-1">
                    <button
                        v-if="post.user.id !== authUserId"
                        class="flex"
                        @click.stop="toggleLike"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 drop-shadow"
                            :class="[
                                isLiked
                                    ? 'bg-brand-orange'
                                    : 'bg-surface dark:bg-ink',
                                likePop ? 'like-pop' : '',
                            ]"
                            :style="
                                iconMaskStyle(
                                    isLiked ? heartFilledIcon : heartIcon,
                                )
                            "
                            @animationend="likePop = false"
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
                            class="inline-block size-6 bg-surface drop-shadow dark:bg-ink"
                            :style="iconMaskStyle(heartIcon)"
                        ></span>
                    </button>
                    <AnimatedCount
                        v-if="likesCount > 0"
                        :value="likesCount"
                        class="text-white drop-shadow"
                    />
                </div>
                <button
                    class="pointer-events-auto flex items-center gap-1 text-white drop-shadow"
                    @click.stop="openComments"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-6 bg-current"
                        :style="iconMaskStyle(messageIcon)"
                    ></span>
                    <AnimatedCount
                        v-if="commentsCount > 0"
                        :value="commentsCount"
                    />
                </button>
                <button
                    v-if="isOwner"
                    class="pointer-events-auto flex items-center text-white drop-shadow disabled:opacity-50"
                    :aria-label="t('Edit post')"
                    :disabled="isLoadingEdit"
                    @click.stop="openEditModal"
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
            v-else-if="post.media_type === 'image'"
            class="relative mx-3 aspect-square transform-gpu overflow-hidden rounded-2xl bg-sand"
            :data-post-media="post.id"
        >
            <button class="block size-full" type="button" @click="onMediaTap">
                <!-- Placeholder underlays stay mounted while the photo fades in
                     on top (classic blur-up), so the card never flashes the bare
                     background mid-transition. Once loaded the shimmer swaps to
                     a static background to stop its animation. -->
                <div
                    class="absolute inset-0"
                    :class="mediaLoaded ? 'bg-surface' : 'shimmer'"
                />
                <img
                    v-if="post.thumbnail_small_url"
                    :src="post.thumbnail_small_url"
                    alt=""
                    aria-hidden="true"
                    class="absolute inset-0 size-full scale-105 object-cover blur-md"
                    loading="lazy"
                />
                <img
                    v-if="post.media_url"
                    v-pinch-zoom
                    :src="post.media_url"
                    :alt="post.caption ?? t('Photo')"
                    class="relative size-full object-cover transition-opacity duration-500"
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
                v-if="showHeartBurst"
                class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
                <span
                    aria-hidden="true"
                    class="heart-burst inline-block size-24 bg-white drop-shadow-lg"
                    :style="iconMaskStyle(heartFilledIcon)"
                    @animationend="showHeartBurst = false"
                ></span>
            </div>
            <button
                v-if="canDownload"
                type="button"
                class="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm disabled:opacity-60"
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
                            :class="[
                                isLiked
                                    ? 'bg-brand-orange'
                                    : 'bg-surface dark:bg-ink',
                                likePop ? 'like-pop' : '',
                            ]"
                            :style="
                                iconMaskStyle(
                                    isLiked ? heartFilledIcon : heartIcon,
                                )
                            "
                            @animationend="likePop = false"
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
                            class="inline-block size-6 bg-surface drop-shadow dark:bg-ink"
                            :style="iconMaskStyle(heartIcon)"
                        ></span>
                    </button>
                    <AnimatedCount
                        v-if="likesCount > 0"
                        :value="likesCount"
                        class="text-white drop-shadow"
                    />
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
                    <AnimatedCount
                        v-if="commentsCount > 0"
                        :value="commentsCount"
                    />
                </button>
                <button
                    v-if="isOwner"
                    class="flex items-center text-white drop-shadow disabled:opacity-50"
                    :aria-label="t('Edit post')"
                    :disabled="isLoadingEdit"
                    @click.stop="openEditModal"
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

        <div v-else-if="post.media_type === 'video'" ref="videoContainerRef">
            <div
                :class="[
                    isFullscreen
                        ? 'fixed inset-0 z-9999 flex items-center justify-center bg-black'
                        : 'relative mx-3 aspect-square transform-gpu overflow-hidden rounded-2xl bg-sand',
                ]"
                :data-post-media="isFullscreen ? undefined : post.id"
                @click="onMediaTap"
            >
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
                <div
                    v-if="
                        post.media_status === 'ready' &&
                        !mediaLoaded &&
                        !isFullscreen
                    "
                    class="absolute inset-0 shimmer"
                />
                <!-- Poster stays mounted underneath so scrolled-past cards
                     (whose player is unmounted) keep showing their frame and
                     the player fades in on top when it returns to view. -->
                <img
                    v-if="
                        post.media_status === 'ready' &&
                        !isFullscreen &&
                        post.thumbnail_url
                    "
                    :src="post.thumbnail_url"
                    :alt="post.caption ?? t('Moment')"
                    class="absolute inset-0 size-full object-cover"
                    loading="lazy"
                />
                <VideoPlayer
                    v-if="showVideo"
                    ref="videoPlayerRef"
                    v-pinch-zoom
                    :src="post.media_url"
                    :poster="post.thumbnail_url"
                    :class="[
                        isFullscreen
                            ? 'max-h-full max-w-full object-contain'
                            : 'size-full object-cover',
                        'transition-opacity duration-500',
                        mediaLoaded ? 'opacity-100' : 'opacity-0',
                    ]"
                    muted
                    autoplay
                    loop
                    preload="metadata"
                    @loadeddata="mediaLoaded = true"
                />

                <div
                    v-if="post.media_status === 'ready'"
                    :class="[
                        'absolute right-3 z-20 flex gap-2',
                        isFullscreen
                            ? 'top-[calc(env(safe-area-inset-top)+1.5rem)]'
                            : 'top-3',
                    ]"
                >
                    <button
                        v-if="!isFullscreen && canDownload"
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
                                :class="[
                                    isLiked
                                        ? 'bg-brand-orange'
                                        : 'bg-surface dark:bg-ink',
                                    likePop ? 'like-pop' : '',
                                ]"
                                :style="
                                    iconMaskStyle(
                                        isLiked ? heartFilledIcon : heartIcon,
                                    )
                                "
                                @animationend="likePop = false"
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
                                class="inline-block size-6 bg-surface drop-shadow dark:bg-ink"
                                :style="iconMaskStyle(heartIcon)"
                            ></span>
                        </button>
                        <AnimatedCount
                            v-if="likesCount > 0"
                            :value="likesCount"
                            class="text-white drop-shadow"
                        />
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
                        <AnimatedCount
                            v-if="commentsCount > 0"
                            :value="commentsCount"
                        />
                    </button>
                    <button
                        v-if="isOwner"
                        class="flex items-center text-white drop-shadow disabled:opacity-50"
                        :aria-label="t('Edit post')"
                        :disabled="isLoadingEdit"
                        @click.stop="openEditModal"
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
        </div>

        <div
            v-else
            class="relative mx-3 aspect-square overflow-hidden rounded-2xl bg-sand"
        >
            <button class="block size-full" type="button" @click="openDetails">
                <div class="flex size-full items-center justify-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-12 text-sand-300"
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

        <button
            v-if="likesSummary"
            type="button"
            class="mt-2 flex w-full items-center gap-2 px-4 py-1 text-left text-ink active:bg-sand-100/40"
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

        <EditPostModal
            v-if="editPost && isOwner"
            :open="isEditModalOpen"
            :post-id="editPost.id"
            :caption="editPost.caption"
            :location="editPost.location ?? null"
            :latitude="editPost.latitude ?? null"
            :longitude="editPost.longitude ?? null"
            :circles="editPost.circles ?? []"
            :available-circles="editAvailableCircles"
            :tags="editPost.tags ?? []"
            :persons="editPost.persons ?? []"
            :available-tags="editAvailableTags"
            :available-persons="editAvailablePersons"
            @update:open="isEditModalOpen = $event"
            @updated="onPostUpdated"
            @deleted="onPostDeleted"
        />
    </article>
</template>
