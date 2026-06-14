import { defineStore } from 'pinia';
import type { PostData } from '@/spa/components/PostCard.vue';
import { externalApi } from '@/spa/http/externalApi';

/** A single printable photo, snapshotted from a feed post's media. */
export interface PrintPhoto {
    /** Unique within the selection: `postId:mediaId`. */
    id: string;
    postId: string;
    /** The post_media id the API needs to resolve the print file. */
    mediaId: string;
    /** Full-resolution rendition, used for the on-screen preview only. */
    url: string;
    /** Small rendition for thumbnails in the shop UI. */
    previewUrl: string;
    width: number | null;
    height: number | null;
}

/** Product family in the app; decides icon, copy, and photo limits. */
export type AppProductId =
    | 'calendar'
    | 'album'
    | 'mug'
    | 'tshirt'
    | 'puzzle'
    | 'canvas';

/** An option the user picks per product, e.g. Size with S/M/L. */
export interface PrintUserOption {
    attribute: string;
    values: string[];
}

/**
 * The artwork's trim size (mm) and orientation policy, straight from the API
 * so a mockup matches the printed result. 'auto' products (canvas, puzzle)
 * follow the photo's orientation; 'fixed' ones keep the size as written.
 */
export interface PrintFormat {
    width: number;
    height: number;
    orientation: 'auto' | 'fixed';
}

/**
 * One orderable offering from the admin-managed catalog. An app product can
 * have several (e.g. a basic and a premium t-shirt).
 */
export interface PrintOffering {
    id: string;
    appProduct: AppProductId;
    /** Localized names keyed like 'nl-NL'; null falls back to the family label. */
    name: Record<string, string> | null;
    priceMinor: number | null;
    currency: string;
    minPhotos: number;
    maxPhotos: number | null;
    userOptions: PrintUserOption[];
    available: boolean;
    format: PrintFormat;
}

/** A product added to the order: photos + offering + chosen options. */
export interface PrintCartItem {
    id: string;
    offeringId: string;
    appProduct: AppProductId;
    /** Display name resolved when the item was added. */
    name: string;
    priceMinor: number;
    photos: PrintPhoto[];
    options: Record<string, string>;
    /** Trim size + orientation, snapshotted so mockups survive a checkout. */
    format: PrintFormat;
}

export interface PrintShippingAddress {
    firstName: string;
    lastName: string;
    street: string;
    houseNumber: string;
    houseNumberAddition?: string;
    postalCode: string;
    city: string;
    country: string;
}

/** Order payload as the API returns it (snake_case, matching the backend). */
export interface PrintOrderSummary {
    id: string;
    /** Sequential, human-friendly order number shown to the user. */
    number: number;
    amount_minor: number;
    currency: string;
    status: 'pending_payment' | 'paid' | 'submitted' | 'failed' | 'canceled';
    printdeal_order_number: string | null;
    printdeal_status: string | null;
    created_at: string | null;
    items: {
        id: string;
        app_product: AppProductId;
        name: Record<string, string> | null;
        options: Record<string, string> | null;
        photo_count: number;
        amount_minor: number;
        printdeal_status: string | null;
    }[];
}

interface CatalogResponse {
    data: {
        id: string;
        app_product: AppProductId;
        name: Record<string, string> | null;
        /** Null when the offering has no price yet (also unavailable then). */
        price_minor: number | null;
        currency: string;
        min_photos: number;
        max_photos: number | null;
        user_options: PrintUserOption[];
        available: boolean;
        format: PrintFormat;
    }[];
    shipping_countries: string[];
    return_url: string;
    /** The user's saved address, if they opted to store one before. */
    saved_address?: PrintShippingAddress | null;
}

interface CreateOrderResponse {
    data: PrintOrderSummary;
    checkout_url: string;
}

/**
 * Translation key for an order status; shared by the shop's "order placed"
 * view and the orders overview so the wording never diverges.
 */
export function printOrderStatusKey(
    status: PrintOrderSummary['status'],
): string {
    switch (status) {
        case 'pending_payment':
            return 'Waiting for your payment';
        case 'paid':
            return 'Payment received';
        case 'submitted':
            return 'Sent to the printer';
        case 'failed':
            return 'Something went wrong, we are on it';
        case 'canceled':
            return 'Payment not completed';
    }
}

/**
 * Collects the printable photos of a post: ready images only, so videos,
 * quotes, and media that is still processing never reach the print flow.
 * Posts without a media array (optimistic uploads) are skipped too; the API
 * needs real media ids to resolve the print files.
 */
export function printablePhotos(post: PostData): PrintPhoto[] {
    if (post.type === 'quote' || !post.media || post.media.length === 0) {
        return [];
    }

    return post.media
        .filter(
            (item) =>
                item.type === 'image' && (item.status ?? 'ready') === 'ready',
        )
        .map((item) => ({
            id: `${post.id}:${item.id}`,
            postId: post.id,
            mediaId: item.id,
            url: item.original_url ?? item.url,
            previewUrl: item.thumbnail_url ?? item.url,
            width: item.width ?? null,
            height: item.height ?? null,
        }));
}

/**
 * The print shop: the photos currently being picked, the catalog of
 * offerings, and the cart that collects products until one checkout pays
 * for all of them in a single order. The cart deliberately survives
 * navigation, so picking photos for a second product never loses the first.
 */
export const usePrintShopStore = defineStore('spa-print-shop', {
    state: () => ({
        /** Photos of the current pick, not yet attached to a cart item. */
        photos: [] as PrintPhoto[],
        selectedOfferingId: null as string | null,
        cart: [] as PrintCartItem[],
        nextCartItemId: 1,
        catalog: null as PrintOffering[] | null,
        shippingCountries: ['NL', 'BE'] as string[],
        returnUrl: 'https://innerr.app',
        submitting: false,
        placedOrder: null as PrintOrderSummary | null,
        // What was just ordered, snapshotted before the cart clears so the
        // confirmation screen can show mockups (the API summary has no photos).
        placedItems: [] as PrintCartItem[],
        /** The user's saved shipping address, used to prefill checkout. */
        savedAddress: null as PrintShippingAddress | null,
    }),
    getters: {
        photoCount: (state): number => state.photos.length,
        offerings(state): PrintOffering[] {
            return state.catalog ?? [];
        },
        selectedOffering(state): PrintOffering | null {
            return (
                this.offerings.find(
                    (offering) => offering.id === state.selectedOfferingId,
                ) ?? null
            );
        },
        /** Whether the current photo pick fits this offering. */
        isSelectable() {
            return (offering: PrintOffering): boolean =>
                offering.available &&
                this.photoCount >= offering.minPhotos &&
                (offering.maxPhotos === null ||
                    this.photoCount <= offering.maxPhotos);
        },
        cartTotalMinor: (state): number =>
            state.cart.reduce((total, item) => total + item.priceMinor, 0),
    },
    actions: {
        /**
         * Loads the offerings from the API. With a catalog already in hand
         * the shop renders that immediately and refreshes in the background,
         * so admin changes (a newly enabled product, a price change) show up
         * on the next shop visit instead of after an app restart.
         */
        async ensureCatalog(): Promise<void> {
            if (this.catalog !== null) {
                this.fetchCatalog().catch(() => {
                    // Stale catalog stays usable when the refresh fails.
                });

                return;
            }

            await this.fetchCatalog();
        },
        async fetchCatalog(): Promise<void> {
            const response =
                await externalApi.get<CatalogResponse>('/print/products');

            this.catalog = response.data.map((offering) => ({
                id: offering.id,
                appProduct: offering.app_product,
                name: offering.name,
                priceMinor: offering.price_minor,
                currency: offering.currency,
                minPhotos: offering.min_photos,
                maxPhotos: offering.max_photos,
                userOptions: offering.user_options ?? [],
                available: offering.available,
                format: offering.format,
            }));
            this.shippingCountries = response.shipping_countries;
            this.returnUrl = response.return_url;
            this.savedAddress = response.saved_address ?? null;
        },
        /** Starts a new photo pick; the cart is intentionally left alone. */
        setPhotosFromPosts(posts: PostData[]): void {
            this.photos = posts.flatMap(printablePhotos);
            this.selectedOfferingId = null;
            this.placedOrder = null;
            this.placedItems = [];
        },
        removePhoto(id: string): void {
            this.photos = this.photos.filter((photo) => photo.id !== id);

            // A changed count can invalidate the choice (e.g. a mug needs
            // exactly one photo), so re-check it instead of keeping an
            // offering that no longer fits.
            const offering = this.selectedOffering;

            if (offering && !this.isSelectable(offering)) {
                this.selectedOfferingId = null;
            }
        },
        selectOffering(id: string): void {
            const offering = this.offerings.find((entry) => entry.id === id);

            if (offering && this.isSelectable(offering)) {
                this.selectedOfferingId = id;
            }
        },
        /**
         * The exact price for an offering with these options. Options like a
         * puzzle's size change the price, so the server quotes the real
         * configuration; the order endpoint recomputes the same amount.
         */
        async quotePrice(
            offeringId: string,
            options: Record<string, string>,
        ): Promise<number> {
            const response = await externalApi.post<{
                data: { price_minor: number };
            }>('/print/quote', {
                offering_id: offeringId,
                options: Object.keys(options).length > 0 ? options : undefined,
            });

            return response.data.price_minor;
        },
        /**
         * Moves the current photo pick plus the selected offering into the
         * cart. The caller is responsible for having collected a value for
         * every user option, and passes the quoted price when options were
         * involved (the base price covers option-less products).
         */
        addToCart(
            name: string,
            options: Record<string, string>,
            priceMinor?: number,
        ): void {
            const offering = this.selectedOffering;
            const price = priceMinor ?? offering?.priceMinor ?? null;

            if (
                offering === null ||
                price === null ||
                this.photos.length === 0
            ) {
                return;
            }

            this.cart.push({
                id: String(this.nextCartItemId++),
                offeringId: offering.id,
                appProduct: offering.appProduct,
                name,
                priceMinor: price,
                photos: this.photos,
                options,
                format: offering.format,
            });

            this.photos = [];
            this.selectedOfferingId = null;
        },
        removeCartItem(id: string): void {
            this.cart = this.cart.filter((item) => item.id !== id);
        },
        /**
         * Creates the order for the whole cart and its Mollie payment;
         * resolves to the checkout URL the user must finish in the browser.
         */
        async submitOrder(
            address: PrintShippingAddress,
            saveAddress = false,
        ): Promise<string> {
            if (this.cart.length === 0 || this.submitting) {
                throw new Error('The order is empty.');
            }

            this.submitting = true;

            try {
                const response = await externalApi.post<CreateOrderResponse>(
                    '/print/orders',
                    {
                        items: this.cart.map((item) => ({
                            offering_id: item.offeringId,
                            photos: item.photos.map((photo) => ({
                                post_id: photo.postId,
                                media_id: photo.mediaId,
                            })),
                            options:
                                Object.keys(item.options).length > 0
                                    ? item.options
                                    : undefined,
                        })),
                        shipping_address: address,
                        save_address: saveAddress,
                        redirect_url: this.returnUrl,
                    },
                );

                // Reflect the opt-in locally so a follow-up order in the same
                // session prefills without waiting for a catalog refresh.
                if (saveAddress) {
                    this.savedAddress = address;
                }

                this.placedOrder = response.data;
                // Snapshot before clearing so the confirmation can show mockups.
                this.placedItems = [...this.cart];
                this.cart = [];
                this.photos = [];
                this.selectedOfferingId = null;

                return response.checkout_url;
            } finally {
                this.submitting = false;
            }
        },
        /** Re-fetch the placed order so the user can watch the status move. */
        async refreshPlacedOrder(): Promise<void> {
            if (this.placedOrder === null) {
                return;
            }

            const response = await externalApi.get<{
                data: PrintOrderSummary;
            }>(`/print/orders/${this.placedOrder.id}`);

            this.placedOrder = response.data;
        },
        /**
         * Clears the transient pick state when leaving the shop. The cart
         * survives on purpose: the user may be off to select photos for the
         * next product.
         */
        resetPick(): void {
            this.photos = [];
            this.selectedOfferingId = null;
            this.placedOrder = null;
        },
    },
});
