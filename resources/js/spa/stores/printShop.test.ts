import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PostData } from '@/spa/components/PostCard.vue';
import { printablePhotos, usePrintShopStore } from './printShop';

function makePost(overrides: Partial<PostData> = {}): PostData {
    return {
        id: 'post-1',
        type: 'media',
        media_url: 'https://cdn.test/full.jpg',
        media_type: 'image',
        thumbnail_url: 'https://cdn.test/thumb.jpg',
        thumbnail_small_url: null,
        media_status: 'ready',
        width: 1200,
        height: 900,
        caption: null,
        location: null,
        created_at: '2026-06-01T10:00:00Z',
        user: { id: 'user-1', name: 'Test', username: 'test', avatar: null },
        is_liked: false,
        likes_count: 0,
        comments_count: 0,
        ...overrides,
    };
}

beforeEach(() => {
    setActivePinia(createPinia());
});

describe('printablePhotos', () => {
    it('maps a single-image post to one photo', () => {
        const photos = printablePhotos(makePost());

        expect(photos).toHaveLength(1);
        expect(photos[0]).toMatchObject({
            id: 'post-1:cover',
            postId: 'post-1',
            url: 'https://cdn.test/full.jpg',
            previewUrl: 'https://cdn.test/thumb.jpg',
        });
    });

    it('prefers the original rendition when available', () => {
        const photos = printablePhotos(
            makePost({ original_media_url: 'https://cdn.test/original.jpg' }),
        );

        expect(photos[0].url).toBe('https://cdn.test/original.jpg');
    });

    it('keeps only ready images from a multi-media post', () => {
        const photos = printablePhotos(
            makePost({
                media: [
                    {
                        id: 'm1',
                        url: 'https://cdn.test/1.jpg',
                        type: 'image',
                        status: 'ready',
                    },
                    {
                        id: 'm2',
                        url: 'https://cdn.test/2.mp4',
                        type: 'video',
                        status: 'ready',
                    },
                    {
                        id: 'm3',
                        url: 'https://cdn.test/3.jpg',
                        type: 'image',
                        status: 'processing',
                    },
                ],
            }),
        );

        expect(photos.map((photo) => photo.id)).toEqual(['post-1:m1']);
    });

    it('excludes quotes, videos, and processing posts', () => {
        expect(printablePhotos(makePost({ type: 'quote' }))).toEqual([]);
        expect(printablePhotos(makePost({ media_type: 'video' }))).toEqual([]);
        expect(
            printablePhotos(makePost({ media_status: 'processing' })),
        ).toEqual([]);
    });
});

describe('print shop store', () => {
    it('flattens selected posts into photos and resets the product', () => {
        const store = usePrintShopStore();
        store.productId = 'mug';

        store.setPhotosFromPosts([
            makePost(),
            makePost({ id: 'post-2', type: 'quote' }),
        ]);

        expect(store.photoCount).toBe(1);
        expect(store.productId).toBeNull();
    });

    it('offers every product for a single photo', () => {
        const store = usePrintShopStore();
        store.setPhotosFromPosts([makePost()]);

        const available = store.products
            .filter((product) => store.isAvailable(product))
            .map((product) => product.id);

        expect(available).toEqual(['calendar', 'album', 'mug', 'tshirt']);
    });

    it('limits multiple photos to calendar and album', () => {
        const store = usePrintShopStore();
        store.setPhotosFromPosts([makePost(), makePost({ id: 'post-2' })]);

        const available = store.products
            .filter((product) => store.isAvailable(product))
            .map((product) => product.id);

        expect(available).toEqual(['calendar', 'album']);
    });

    it('refuses to select an unavailable product', () => {
        const store = usePrintShopStore();
        store.setPhotosFromPosts([makePost(), makePost({ id: 'post-2' })]);

        store.selectProduct('mug');

        expect(store.productId).toBeNull();
    });

    it('keeps a valid product but drops one invalidated by removal', () => {
        const store = usePrintShopStore();
        store.setPhotosFromPosts([makePost(), makePost({ id: 'post-2' })]);
        store.selectProduct('album');

        store.removePhoto('post-2:cover');

        // One photo still satisfies the album's minimum.
        expect(store.productId).toBe('album');

        store.selectProduct('mug');
        store.setPhotosFromPosts([makePost(), makePost({ id: 'post-2' })]);
        store.selectProduct('album');
        store.removePhoto('post-1:cover');
        store.removePhoto('post-2:cover');

        expect(store.photoCount).toBe(0);
        expect(store.productId).toBeNull();
    });
});
