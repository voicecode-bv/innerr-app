import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostData } from '@/spa/components/PostCard.vue';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('@/spa/http/externalApi', () => ({
    externalApi: {
        get: (path: string) => apiGet(path),
        post: (path: string, body: unknown) => apiPost(path, body),
    },
}));

const { printablePhotos, usePrintShopStore } = await import('./printShop');

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
        media: [
            {
                id: 'm1',
                url: 'https://cdn.test/full.jpg',
                type: 'image',
                status: 'ready',
                thumbnail_url: 'https://cdn.test/thumb.jpg',
            },
        ],
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

function catalogResponse() {
    return {
        data: [
            {
                id: 'offering-album',
                app_product: 'album',
                name: { 'nl-NL': 'Fotoalbum', 'en-EN': 'Photo album' },
                price_minor: 2495,
                currency: 'EUR',
                min_photos: 1,
                max_photos: 50,
                user_options: [],
                available: true,
            },
            {
                id: 'offering-basic-tee',
                app_product: 'tshirt',
                name: { 'en-EN': 'Basic T-shirt' },
                price_minor: 1995,
                currency: 'EUR',
                min_photos: 1,
                max_photos: 1,
                user_options: [{ attribute: 'Size', values: ['S', 'M', 'L'] }],
                available: true,
            },
            {
                id: 'offering-premium-tee',
                app_product: 'tshirt',
                name: { 'en-EN': 'Premium T-shirt' },
                price_minor: 2995,
                currency: 'EUR',
                min_photos: 1,
                max_photos: 1,
                user_options: [{ attribute: 'Size', values: ['S', 'M', 'L'] }],
                available: false,
            },
        ],
        shipping_countries: ['NL', 'BE'],
        return_url: 'https://innerr.app/print',
    };
}

async function makeLoadedStore() {
    apiGet.mockResolvedValue(catalogResponse());
    const store = usePrintShopStore();
    await store.ensureCatalog();

    return store;
}

beforeEach(() => {
    setActivePinia(createPinia());
    apiGet.mockReset();
    apiPost.mockReset();
});

describe('printablePhotos', () => {
    it('maps ready images with their media ids', function () {
        const photos = printablePhotos(makePost());

        expect(photos).toHaveLength(1);
        expect(photos[0]).toMatchObject({
            id: 'post-1:m1',
            postId: 'post-1',
            mediaId: 'm1',
            previewUrl: 'https://cdn.test/thumb.jpg',
        });
    });

    it('keeps only ready images and excludes quotes and empty posts', () => {
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
        expect(printablePhotos(makePost({ type: 'quote' }))).toEqual([]);
        expect(printablePhotos(makePost({ media: [] }))).toEqual([]);
    });
});

describe('print shop store', () => {
    it('loads offerings, including multiple per app product', async () => {
        const store = await makeLoadedStore();

        expect(apiGet).toHaveBeenCalledWith('/print/products');
        expect(store.offerings).toHaveLength(3);
        expect(
            store.offerings.filter((o) => o.appProduct === 'tshirt'),
        ).toHaveLength(2);
        expect(store.shippingCountries).toEqual(['NL', 'BE']);
        expect(store.returnUrl).toBe('https://innerr.app/print');
    });

    it('only lets selectable offerings be selected', async () => {
        const store = await makeLoadedStore();
        store.setPhotosFromPosts([makePost(), makePost({ id: 'post-2' })]);

        // Two photos: t-shirts (max 1) do not qualify.
        store.selectOffering('offering-basic-tee');
        expect(store.selectedOfferingId).toBeNull();

        store.selectOffering('offering-album');
        expect(store.selectedOfferingId).toBe('offering-album');

        // Unavailable offerings never qualify.
        store.setPhotosFromPosts([makePost()]);
        store.selectOffering('offering-premium-tee');
        expect(store.selectedOfferingId).toBeNull();
    });

    it('collects multiple products in the cart without losing earlier ones', async () => {
        const store = await makeLoadedStore();

        store.setPhotosFromPosts([makePost()]);
        store.selectOffering('offering-album');
        store.addToCart('Fotoalbum', {});

        expect(store.cart).toHaveLength(1);
        // The pick is consumed; the next product starts fresh.
        expect(store.photoCount).toBe(0);
        expect(store.selectedOfferingId).toBeNull();

        store.setPhotosFromPosts([makePost({ id: 'post-2' })]);
        store.selectOffering('offering-basic-tee');
        store.addToCart('Basic T-shirt', { Size: 'M' });

        expect(store.cart).toHaveLength(2);
        expect(store.cart[0].name).toBe('Fotoalbum');
        expect(store.cart[1].options).toEqual({ Size: 'M' });
        expect(store.cartTotalMinor).toBe(2495 + 1995);

        store.removeCartItem(store.cart[0].id);
        expect(store.cart).toHaveLength(1);
        expect(store.cartTotalMinor).toBe(1995);
    });

    it('keeps the cart when a new photo pick starts', async () => {
        const store = await makeLoadedStore();
        store.setPhotosFromPosts([makePost()]);
        store.selectOffering('offering-album');
        store.addToCart('Fotoalbum', {});

        store.setPhotosFromPosts([makePost({ id: 'post-2' })]);
        store.resetPick();

        expect(store.cart).toHaveLength(1);
        expect(store.photoCount).toBe(0);
    });

    it('submits the whole cart as one order and clears it', async () => {
        apiPost.mockResolvedValue({
            data: { id: 'order-1', status: 'pending_payment', items: [] },
            checkout_url: 'https://mollie.test/checkout/abc',
        });

        const store = await makeLoadedStore();
        store.setPhotosFromPosts([makePost()]);
        store.selectOffering('offering-album');
        store.addToCart('Fotoalbum', {});
        store.setPhotosFromPosts([makePost({ id: 'post-2' })]);
        store.selectOffering('offering-basic-tee');
        store.addToCart('Basic T-shirt', { Size: 'M' });

        const checkoutUrl = await store.submitOrder({
            firstName: 'Michael',
            lastName: 'Blijleven',
            street: 'Hoofdstraat',
            houseNumber: '1',
            postalCode: '1234AB',
            city: 'Amsterdam',
            country: 'NL',
        });

        expect(checkoutUrl).toBe('https://mollie.test/checkout/abc');
        expect(store.placedOrder?.id).toBe('order-1');
        expect(store.cart).toHaveLength(0);
        expect(apiPost).toHaveBeenCalledWith(
            '/print/orders',
            expect.objectContaining({
                items: [
                    expect.objectContaining({
                        offering_id: 'offering-album',
                        photos: [{ post_id: 'post-1', media_id: 'm1' }],
                        options: undefined,
                    }),
                    expect.objectContaining({
                        offering_id: 'offering-basic-tee',
                        options: { Size: 'M' },
                    }),
                ],
                redirect_url: 'https://innerr.app/print',
            }),
        );
    });
});
