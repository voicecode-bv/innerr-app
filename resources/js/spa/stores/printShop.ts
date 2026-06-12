import { defineStore } from 'pinia';
import type { PostData } from '@/spa/components/PostCard.vue';

/** A single printable photo, snapshotted from a feed post's media. */
export interface PrintPhoto {
    /** Unique within the selection: `postId:mediaId`. */
    id: string;
    postId: string;
    /** Full-resolution rendition, what the print partner will receive. */
    url: string;
    /** Small rendition for thumbnails in the shop UI. */
    previewUrl: string;
    width: number | null;
    height: number | null;
}

export type PrintProductId = 'calendar' | 'album' | 'mug' | 'tshirt';

export interface PrintProduct {
    id: PrintProductId;
    /** Indicative "from" price in euros, until the API provides real pricing. */
    priceFrom: number;
    minPhotos: number;
    /** null = no upper bound. */
    maxPhotos: number | null;
}

/**
 * The catalog is a hardcoded placeholder until the print API exists; names and
 * descriptions live in the components so they go through `t()`.
 */
export const PRINT_PRODUCTS: PrintProduct[] = [
    { id: 'calendar', priceFrom: 19.95, minPhotos: 1, maxPhotos: null },
    { id: 'album', priceFrom: 24.95, minPhotos: 1, maxPhotos: null },
    { id: 'mug', priceFrom: 14.95, minPhotos: 1, maxPhotos: 1 },
    { id: 'tshirt', priceFrom: 19.95, minPhotos: 1, maxPhotos: 1 },
];

/**
 * Collects the printable photos of a post: ready images only, so videos,
 * quotes, and media that is still processing never reach the print flow.
 */
export function printablePhotos(post: PostData): PrintPhoto[] {
    if (post.type === 'quote') {
        return [];
    }

    if (post.media && post.media.length > 0) {
        return post.media
            .filter(
                (item) =>
                    item.type === 'image' &&
                    (item.status ?? 'ready') === 'ready',
            )
            .map((item) => ({
                id: `${post.id}:${item.id}`,
                postId: post.id,
                url: item.original_url ?? item.url,
                previewUrl: item.thumbnail_url ?? item.url,
                width: item.width ?? null,
                height: item.height ?? null,
            }));
    }

    if (post.media_type === 'video' || post.media_status !== 'ready') {
        return [];
    }

    return [
        {
            id: `${post.id}:cover`,
            postId: post.id,
            url: post.original_media_url ?? post.media_url,
            previewUrl: post.thumbnail_url ?? post.media_url,
            width: post.width ?? null,
            height: post.height ?? null,
        },
    ];
}

/**
 * Holds the photos a user picked in the feed and the print product they chose.
 * Purely client-side for now; `submitOrder` is the seam where the print API
 * will plug in later.
 */
export const usePrintShopStore = defineStore('spa-print-shop', {
    state: () => ({
        photos: [] as PrintPhoto[],
        productId: null as PrintProductId | null,
    }),
    getters: {
        photoCount: (state): number => state.photos.length,
        products: (): PrintProduct[] => PRINT_PRODUCTS,
        selectedProduct(state): PrintProduct | null {
            return (
                PRINT_PRODUCTS.find(
                    (product) => product.id === state.productId,
                ) ?? null
            );
        },
        isAvailable() {
            return (product: PrintProduct): boolean =>
                this.photoCount >= product.minPhotos &&
                (product.maxPhotos === null ||
                    this.photoCount <= product.maxPhotos);
        },
    },
    actions: {
        setPhotosFromPosts(posts: PostData[]): void {
            this.photos = posts.flatMap(printablePhotos);
            this.productId = null;
        },
        removePhoto(id: string): void {
            this.photos = this.photos.filter((photo) => photo.id !== id);

            // A changed count can invalidate the choice (e.g. a mug needs
            // exactly one photo), so re-check it instead of keeping a product
            // that can no longer be ordered.
            const product = this.selectedProduct;

            if (product && !this.isAvailable(product)) {
                this.productId = null;
            }
        },
        selectProduct(id: PrintProductId): void {
            const product = PRINT_PRODUCTS.find((entry) => entry.id === id);

            if (product && this.isAvailable(product)) {
                this.productId = id;
            }
        },
        /**
         * TODO: submit to the print API once it exists. Until then the UI
         * shows a "coming soon" notice when this resolves to 'unavailable'.
         */
        async submitOrder(): Promise<'unavailable'> {
            return 'unavailable';
        },
        reset(): void {
            this.photos = [];
            this.productId = null;
        },
    },
});
