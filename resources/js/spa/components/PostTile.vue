<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AnimatedCount from '@/components/AnimatedCount.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import VideoPlayer from '@/spa/components/VideoPlayer.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { haptics } from '@/spa/services/haptics';
import { openPostWithHeroTransition } from '@/spa/services/postHeroTransition';
import { useAuthStore } from '@/spa/stores/auth';
import copyIcon from '../../../svg/doodle-icons/copy.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import messageIcon from '../../../svg/doodle-icons/message.svg';
import playIcon from '../../../svg/doodle-icons/play.svg';

const props = withDefaults(
    defineProps<{
        post: PostData;
        /**
         * Optional poster override. Profiles use it to swap in a locally-generated
         * thumbnail for a freshly uploaded video that has no CDN poster yet. When
         * it returns null the tile falls back to the API media below.
         */
        resolvePoster?: (post: PostData) => string | null;
        /** Selection mode is active: tapping toggles selection instead of opening. */
        selectionMode?: boolean;
        /** Whether this tile is currently part of the selection. */
        selected?: boolean;
        /**
         * Overrides which tiles can be selected. When omitted the tile falls
         * back to the owner check (the circle-assignment default); the print
         * flow passes its own predicate result since any printable photo in
         * the feed qualifies there.
         */
        canSelect?: boolean;
    }>(),
    {
        resolvePoster: undefined,
        selectionMode: false,
        selected: false,
        canSelect: undefined,
    },
);

const emit = defineEmits<{
    (e: 'open-comments', postId: string): void;
    (e: 'open-likes', postId: string): void;
    (e: 'toggle-select', postId: string): void;
}>();

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();

const isOwner = computed(() => props.post.user?.id === auth.user?.id);

// Tiles that don't qualify for the active selection intent are dimmed and
// inert. Without an explicit `canSelect` only own posts qualify (the
// circle-assignment rule).
const isSelectable = computed(
    () => props.selectionMode && (props.canSelect ?? isOwner.value),
);

const isVideo = computed(() => props.post.media_type === 'video');
const isQuote = computed(() => props.post.type === 'quote');

// Multi-photo posts collapse to a single cover tile in the masonry grid, so the
// only cue that more media is hidden behind it is this badge. Tapping the tile
// opens the detail carousel, which lets the user swipe through the rest.
const mediaCount = computed(() => props.post.media?.length ?? 0);
const hasMultipleMedia = computed(() => mediaCount.value > 1);
const isProcessing = computed(() => props.post.media_status === 'processing');

// Only ready videos can stream; processing/failed ones stay on the poster.
const isVideoReady = computed(
    () => isVideo.value && props.post.media_status === 'ready',
);

// Autoplay is gated on visibility: an IntersectionObserver mounts the
// VideoPlayer only while the tile is on (or near) screen and unmounts it on
// the way out. That caps the number of live hls.js workers to the handful of
// visible tiles, so a grid full of videos never spins up a player per item.
const rootRef = ref<HTMLElement | null>(null);
const isInView = ref(false);
const videoLoaded = ref(false);
let intersectionObserver: IntersectionObserver | null = null;

const showVideo = computed(() => isVideoReady.value && isInView.value);

function onVideoLoaded(): void {
    videoLoaded.value = true;
}

// Image tiles render the medium thumbnail: tiles are a couple hundred pixels
// wide at most, so the full display rendition wastes bandwidth and decode
// time. Video tiles use the poster. Both preserve the natural ratio and
// reserve their height up front from the API dimensions so the grid never
// reflows while scrolling.
const posterSrc = computed(() => {
    const override = props.resolvePoster?.(props.post);

    if (override) {
        return override;
    }

    if (isVideo.value) {
        return props.post.thumbnail_url;
    }

    return props.post.thumbnail_url ?? props.post.media_url;
});

// Natural ratio read from the loaded image, used as a fallback when the API
// has no stored dimensions yet (legacy posts pending backfill, or media we
// couldn't measure). Keeps tiles at their true ratio instead of cropping to a
// square. When the API does provide width/height the tile reserves its height
// up front, so the grid never reflows while scrolling.
const loadedRatio = ref<string | null>(null);

const aspectRatio = computed(() => {
    const { width, height } = props.post;

    if (width && height) {
        return `${width} / ${height}`;
    }

    return loadedRatio.value ?? '1 / 1';
});

const mediaLoaded = ref(false);

function onMediaLoad(event: Event): void {
    mediaLoaded.value = true;

    if (props.post.width && props.post.height) {
        return;
    }

    const img = event.target as HTMLImageElement;

    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        loadedRatio.value = `${img.naturalWidth} / ${img.naturalHeight}`;
    }
}

// Local like state, seeded from the post and updated optimistically — mirrors
// PostCard so liking from the grid behaves the same as from the list feed.
const isLiked = ref(props.post.is_liked);
const likesCount = ref(props.post.likes_count);

function onHeartClick(): void {
    // Owners can't like their own post; the heart opens the likers list instead.
    if (isOwner.value) {
        emit('open-likes', props.post.id);

        return;
    }

    void toggleLike();
}

// Transient flag driving the heart's pop animation; cleared on animationend
// so a follow-up like can replay it. Mirrors PostCard.
const likePop = ref(false);

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
        }
    } catch {
        isLiked.value = wasLiked;
        likesCount.value += wasLiked ? 1 : -1;
    }
}

function openComments(): void {
    emit('open-comments', props.post.id);
}

function openDetails(): void {
    void openPostWithHeroTransition(props.post.id, () =>
        router.push({
            name: 'spa.posts.show',
            params: { post: props.post.id },
        }),
    );
}

// Double-tap on the tile likes the post (never unlikes, Instagram style).
// Because a single tap opens the post detail, likeable posts wait one
// double-tap window before navigating; own posts keep the instant tap.
// Mirrors PostCard.
const DOUBLE_TAP_MS = 260;
let tapTimer: number | null = null;

// Large heart that springs in over the media after a double-tap like.
const showHeartBurst = ref(false);

function onTileClick(): void {
    if (props.selectionMode) {
        if (isSelectable.value) {
            emit('toggle-select', props.post.id);
        }

        return;
    }

    if (isOwner.value) {
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

onMounted(() => {
    if (typeof IntersectionObserver === 'undefined' || !rootRef.value) {
        // No observer support: leave videos on their poster rather than eagerly
        // mounting a player for every tile.
        return;
    }

    intersectionObserver = new IntersectionObserver(
        (entries) => {
            isInView.value = entries[0]?.isIntersecting ?? false;

            if (!isInView.value) {
                // Reset so the next time the tile scrolls back in, the freshly
                // mounted player fades in over its poster again.
                videoLoaded.value = false;
            }
        },
        // Start buffering just before the tile reaches the viewport so playback
        // begins without a visible gap, but keep the margin tight to avoid
        // mounting players that are still well off-screen.
        { rootMargin: '100px 0px', threshold: 0.1 },
    );

    intersectionObserver.observe(rootRef.value);
});

onUnmounted(() => {
    intersectionObserver?.disconnect();
    intersectionObserver = null;

    if (tapTimer !== null) {
        window.clearTimeout(tapTimer);
        tapTimer = null;
    }
});

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
    <!-- content-visibility lets the browser skip layout/paint (and drop
         decoded image bitmaps) for tiles far off-screen, which bounds memory
         on infinite feeds. The explicit aspect-ratio below keeps the tile's
         box size exact even while its contents are skipped. -->
    <div
        ref="rootRef"
        class="relative w-full overflow-hidden rounded-2xl bg-sand shadow-sm transition-all [content-visibility:auto]"
        :class="[
            selected ? 'ring-2 ring-action' : 'ring-1 ring-sand-100',
            selectionMode && !isSelectable ? 'opacity-40' : '',
        ]"
        :style="{ aspectRatio }"
        :data-post-media="post.id"
    >
        <button
            type="button"
            class="block size-full active:opacity-90"
            :disabled="selectionMode && !isSelectable"
            :aria-label="
                selectionMode
                    ? selected
                        ? t('Deselect photo')
                        : t('Select photo')
                    : t('Open post')
            "
            @click="onTileClick"
        >
            <!-- Stays mounted while the poster fades in on top, so the tile
                 never flashes the bare background mid-transition. Once loaded
                 the shimmer swaps to a static background to stop animating. -->
            <div
                class="absolute inset-0"
                :class="mediaLoaded ? 'bg-surface' : 'shimmer'"
            />
            <img
                v-if="posterSrc"
                :src="posterSrc"
                :alt="t('Photo')"
                class="relative size-full object-cover transition-opacity duration-500"
                :class="mediaLoaded ? 'opacity-100' : 'opacity-0'"
                loading="lazy"
                @load="onMediaLoad"
            />
            <VideoPlayer
                v-if="showVideo"
                :src="post.media_url"
                :poster="post.thumbnail_url"
                class="absolute inset-0 size-full object-cover transition-opacity duration-500"
                :class="videoLoaded ? 'opacity-100' : 'opacity-0'"
                muted
                autoplay
                loop
                preload="metadata"
                @loadeddata="onVideoLoaded"
            />
        </button>

        <div
            v-if="showHeartBurst"
            class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        >
            <span
                aria-hidden="true"
                class="heart-burst inline-block size-16 bg-white drop-shadow-lg"
                :style="iconMaskStyle(heartFilledIcon)"
                @animationend="showHeartBurst = false"
            ></span>
        </div>

        <span
            v-if="isSelectable"
            aria-hidden="true"
            class="pointer-events-none absolute top-2 left-2 flex size-6 items-center justify-center rounded-full ring-2 ring-white transition-colors"
            :class="selected ? 'bg-action' : 'bg-black/30'"
        >
            <svg
                v-if="selected"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="3"
                stroke="currentColor"
                class="size-3.5 text-white"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                />
            </svg>
        </span>

        <span
            v-if="isQuote"
            aria-hidden="true"
            class="pointer-events-none absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-black/45 font-display text-base leading-none text-white backdrop-blur-sm"
            >&ldquo;</span
        >

        <div
            v-if="
                hasMultipleMedia ||
                (isVideo && !isProcessing && !(showVideo && videoLoaded))
            "
            class="pointer-events-none absolute top-2 right-2 flex items-center gap-1.5"
        >
            <span
                v-if="hasMultipleMedia"
                class="flex h-7 items-center gap-1 rounded-full bg-black/50 px-2 text-white backdrop-blur-sm"
                :aria-label="t(':count photos', { count: mediaCount })"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-3.5 bg-white"
                    :style="iconMaskStyle(copyIcon)"
                ></span>
                <span class="text-xs leading-none">{{ mediaCount }}</span>
            </span>
            <span
                v-if="isVideo && !isProcessing && !(showVideo && videoLoaded)"
                aria-hidden="true"
                class="flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
            >
                <span
                    class="inline-block size-4 bg-white"
                    :style="iconMaskStyle(playIcon)"
                ></span>
            </span>
        </div>

        <div
            v-if="isProcessing"
            class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35"
        >
            <span
                class="rounded-full bg-black/55 px-2.5 py-1 text-xs text-white"
                >{{ isVideo ? t('Processing') : t('Uploading...') }}</span
            >
        </div>

        <div
            v-if="!selectionMode"
            class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 pt-8 pb-2 text-white"
        >
            <button
                type="button"
                class="pointer-events-auto flex items-center gap-1"
                :aria-label="isOwner ? t('Show likes') : t('Like')"
                @click="onHeartClick"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-5 drop-shadow"
                    :class="[
                        isLiked ? 'bg-brand-orange' : 'bg-white',
                        likePop ? 'like-pop' : '',
                    ]"
                    :style="
                        iconMaskStyle(isLiked ? heartFilledIcon : heartIcon)
                    "
                    @animationend="likePop = false"
                ></span>
                <AnimatedCount
                    v-if="likesCount > 0"
                    :value="likesCount"
                    class="text-xs drop-shadow"
                />
            </button>
            <button
                type="button"
                class="pointer-events-auto flex items-center gap-1"
                :aria-label="t('Comments')"
                @click="openComments"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-5 bg-white drop-shadow"
                    :style="iconMaskStyle(messageIcon)"
                ></span>
                <AnimatedCount
                    v-if="post.comments_count > 0"
                    :value="post.comments_count"
                    class="text-xs drop-shadow"
                />
            </button>
        </div>
    </div>
</template>
