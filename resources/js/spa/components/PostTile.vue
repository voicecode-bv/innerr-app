<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { PostData } from '@/spa/components/PostCard.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { useAuthStore } from '@/spa/stores/auth';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import messageIcon from '../../../svg/doodle-icons/message.svg';
import playIcon from '../../../svg/doodle-icons/play.svg';

const props = defineProps<{
    post: PostData;
    /**
     * Optional poster override. Profiles use it to swap in a locally-generated
     * thumbnail for a freshly uploaded video that has no CDN poster yet. When
     * it returns null the tile falls back to the API media below.
     */
    resolvePoster?: (post: PostData) => string | null;
}>();

const emit = defineEmits<{
    (e: 'open-comments', postId: string): void;
    (e: 'open-likes', postId: string): void;
}>();

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();

const isOwner = computed(() => props.post.user?.id === auth.user?.id);

const isVideo = computed(() => props.post.media_type === 'video');
const isProcessing = computed(() => props.post.media_status === 'processing');

// Image tiles render the display image at its natural ratio; video tiles use
// the poster (also aspect-preserving). Both reserve their height up front from
// the API dimensions so the grid never reflows while scrolling.
const posterSrc = computed(
    () =>
        props.resolvePoster?.(props.post) ??
        (isVideo.value ? props.post.thumbnail_url : props.post.media_url),
);

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

function openComments(): void {
    emit('open-comments', props.post.id);
}

function openDetails(): void {
    router.push({
        name: 'spa.posts.show',
        params: { post: props.post.id },
    });
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
    <div
        class="relative w-full overflow-hidden rounded-2xl bg-sand shadow-sm ring-1 ring-sand-100"
        :style="{ aspectRatio }"
    >
        <button
            type="button"
            class="block size-full active:opacity-90"
            :aria-label="t('Open post')"
            @click="openDetails"
        >
            <div v-if="!mediaLoaded" class="absolute inset-0 shimmer" />
            <img
                v-if="posterSrc"
                :src="posterSrc"
                :alt="t('Photo')"
                class="size-full object-cover transition-opacity duration-500"
                :class="mediaLoaded ? 'opacity-100' : 'opacity-0'"
                loading="lazy"
                @load="onMediaLoad"
            />
        </button>

        <span
            v-if="isVideo && !isProcessing"
            aria-hidden="true"
            class="pointer-events-none absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
        >
            <span
                class="inline-block size-4 bg-white"
                :style="iconMaskStyle(playIcon)"
            ></span>
        </span>

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
                    :class="isLiked ? 'bg-brand-orange' : 'bg-white'"
                    :style="
                        iconMaskStyle(isLiked ? heartFilledIcon : heartIcon)
                    "
                ></span>
                <span v-if="likesCount > 0" class="text-xs drop-shadow">{{
                    likesCount
                }}</span>
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
                <span
                    v-if="post.comments_count > 0"
                    class="text-xs drop-shadow"
                    >{{ post.comments_count }}</span
                >
            </button>
        </div>
    </div>
</template>
