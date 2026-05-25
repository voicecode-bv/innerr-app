<script setup lang="ts">
import { computed, reactive } from 'vue';
import { RouterLink } from 'vue-router';
import type { PostData, PostMediaItem } from '@/spa/components/PostCard.vue';
import { useTranslations } from '@/spa/composables/useTranslations';

const props = withDefaults(
    defineProps<{
        posts: PostData[];
        loading?: boolean;
        /**
         * Resolver voor de video-cover-thumbnail. Profielen geven hier hun
         * lokale-thumbnail-fallback mee voor net ge-uploade video's; standaard
         * pakken we de CDN-poster.
         */
        resolveVideoThumbnail?: (post: PostData) => string | null;
    }>(),
    {
        loading: false,
        resolveVideoThumbnail: undefined,
    },
);

const { t } = useTranslations();

// Loaded-state per media-URL i.p.v. per post.id zodat een wijziging in de
// bron-URL automatisch opnieuw een skeleton triggert.
const loadedMedia = reactive<Record<string, boolean>>({});

function markLoaded(url: string): void {
    loadedMedia[url] = true;
}

interface GridTile {
    postId: string;
    key: string;
    src: string;
    mediaType: string;
    mediaStatus: 'processing' | 'ready' | 'failed';
    caption: string | null;
    // Index van dit item binnen `post.media`; gebruikt om de post-detail op
    // de juiste carousel-slide te openen. 0 voor enkele-media cover-tegels.
    mediaIndex: number;
}

// Grid-thumbnail per media-item: 300x300 grid-poster -> grote thumbnail ->
// originele media.
function itemThumbnail(item: PostMediaItem): string {
    return item.thumbnail_small_url ?? item.thumbnail_url ?? item.url;
}

function coverThumbnail(post: PostData): string {
    if (post.media_type === 'video') {
        const resolver = props.resolveVideoThumbnail;

        return (
            (resolver
                ? resolver(post)
                : (post.thumbnail_url ?? post.media_url)) ?? ''
        );
    }

    return post.thumbnail_small_url ?? post.thumbnail_url ?? post.media_url;
}

// Eén tegel per foto: multi-photo posts klappen we uit naar losse tegels die
// allemaal naar dezelfde post-detail linken. Posts met 0 of 1 media-items
// (of een oude API zonder `media`) vallen terug op de cover-tegel.
const tiles = computed<GridTile[]>(() => {
    const result: GridTile[] = [];

    for (const post of props.posts) {
        const items = post.media ?? [];

        if (items.length > 1) {
            items.forEach((item, index) => {
                result.push({
                    postId: post.id,
                    key: item.id,
                    src: itemThumbnail(item),
                    mediaType: item.type,
                    mediaStatus: item.status ?? 'ready',
                    caption: post.caption,
                    mediaIndex: index,
                });
            });

            continue;
        }

        result.push({
            postId: post.id,
            key: post.id,
            src: coverThumbnail(post),
            mediaType: post.media_type,
            mediaStatus: post.media_status,
            caption: post.caption,
            mediaIndex: 0,
        });
    }

    return result;
});

// Alleen secundaire slides (index > 0) krijgen een `media`-query mee; de
// cover opent de post zonder query zodat bestaande links onveranderd blijven.
function tileTo(tile: GridTile) {
    return {
        name: 'spa.posts.show',
        params: { post: tile.postId },
        ...(tile.mediaIndex > 0
            ? { query: { media: String(tile.mediaIndex) } }
            : {}),
    };
}
</script>

<template>
    <div
        v-if="loading && posts.length === 0"
        class="grid grid-cols-3 gap-1 bg-sand px-1"
    >
        <div
            v-for="n in 30"
            :key="n"
            class="aspect-square animate-pulse rounded-lg bg-sand-100"
        />
    </div>

    <div v-else class="grid grid-cols-3 gap-1 bg-sand px-1">
        <RouterLink
            v-for="tile in tiles"
            :key="tile.key"
            :to="tileTo(tile)"
            class="relative block aspect-square overflow-hidden rounded-lg bg-sand"
        >
            <div
                v-if="!loadedMedia[tile.src] && tile.mediaType !== 'unknown'"
                class="absolute inset-0 animate-pulse bg-sand"
            />
            <img
                v-if="tile.mediaType === 'image' || tile.mediaType === 'video'"
                :src="tile.src"
                :alt="
                    tile.caption ??
                    (tile.mediaType === 'video' ? t('Moment') : t('Photo'))
                "
                class="relative size-full object-cover transition-opacity duration-300"
                :class="loadedMedia[tile.src] ? 'opacity-100' : 'opacity-0'"
                loading="lazy"
                decoding="async"
                @load="markLoaded(tile.src)"
            />
            <div
                v-if="tile.mediaType === 'video'"
                class="absolute top-1.5 right-1.5 z-10"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="size-4 text-white drop-shadow"
                >
                    <path
                        d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
                    />
                </svg>
            </div>
        </RouterLink>
    </div>
</template>
