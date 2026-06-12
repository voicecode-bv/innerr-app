<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import BottomSheet from '@/components/BottomSheet.vue';
import Button from '@/components/Button.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import SheetHeader from '@/components/SheetHeader.vue';
import TextField from '@/spa/components/TextField.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { haptics } from '@/spa/services/haptics';
import { useFeedSelectionStore } from '@/spa/stores/feedSelection';
import { usePrintShopStore } from '@/spa/stores/printShop';
import type { AppProductId, PrintOffering } from '@/spa/stores/printShop';
import { Browser, Dialog } from '@nativephp/mobile';
import calendarIcon from '../../../svg/doodle-icons/calendar.svg';
import coffeeCupIcon from '../../../svg/doodle-icons/coffee-cup-1.svg';
import crossIcon from '../../../svg/doodle-icons/cross.svg';
import photoIcon from '../../../svg/doodle-icons/photo.svg';
import puzzleIcon from '../../../svg/doodle-icons/puzzle.svg';
import tShirtIcon from '../../../svg/doodle-icons/t-shirt.svg';
import tickIcon from '../../../svg/doodle-icons/tick-2.svg';
import truckIcon from '../../../svg/doodle-icons/truck.svg';

const router = useRouter();
const { t, locale } = useTranslations();
const printShop = usePrintShopStore();
const feedSelection = useFeedSelectionStore();

// Category-level presentation; the concrete products inside a category come
// from the catalog and carry their own (Printdeal) names.
const categoryMeta: Record<
    AppProductId,
    {
        icon: string;
        tile: string;
        label: () => string;
        description: () => string;
    }
> = {
    calendar: {
        icon: calendarIcon,
        tile: 'bg-brand-yellow text-brand-blue',
        label: () => t('Photo calendar'),
        description: () =>
            t('Twelve months of your favourite moments on the wall.'),
    },
    album: {
        icon: photoIcon,
        tile: 'bg-brand-blue text-brand-sand',
        label: () => t('Photo album'),
        description: () =>
            t('A beautifully bound book to leaf through together.'),
    },
    mug: {
        icon: coffeeCupIcon,
        tile: 'bg-brand-orange text-white',
        label: () => t('Mug'),
        description: () => t('Start every morning with a treasured memory.'),
    },
    tshirt: {
        icon: tShirtIcon,
        tile: 'bg-sage-100 text-sage-700',
        label: () => t('T-shirt'),
        description: () => t('Wear your favourite moment wherever you go.'),
    },
    puzzle: {
        icon: puzzleIcon,
        tile: 'bg-brand-green text-white',
        label: () => t('Photo puzzle'),
        description: () =>
            t('Piece your favourite moment together, again and again.'),
    },
};

const categoryOrder: AppProductId[] = [
    'calendar',
    'album',
    'mug',
    'tshirt',
    'puzzle',
];

function displayName(
    name: Record<string, string> | null,
    appProduct: AppProductId,
): string {
    const localeKey = `${locale.value}-${locale.value.toUpperCase()}`;

    return (
        name?.[localeKey] ?? name?.['en-EN'] ?? categoryMeta[appProduct].label()
    );
}

interface CategoryCard {
    appProduct: AppProductId;
    offerings: PrintOffering[];
    selectable: PrintOffering[];
    /** Lowest price among the currently selectable products. */
    fromPriceMinor: number | null;
}

// One card per category; tapping it opens the product chooser for that
// category. Categories without any offering render as "coming soon".
const categories = computed<CategoryCard[]>(() =>
    categoryOrder.map((appProduct) => {
        const offerings = printShop.offerings.filter(
            (offering) => offering.appProduct === appProduct,
        );
        const selectable = offerings.filter((offering) =>
            printShop.isSelectable(offering),
        );

        return {
            appProduct,
            offerings,
            selectable,
            fromPriceMinor: selectable.length
                ? Math.min(
                      ...selectable.map(
                          (offering) => offering.priceMinor ?? Infinity,
                      ),
                  )
                : null,
        };
    }),
);

function categoryUnavailableReason(category: CategoryCard): string {
    if (category.offerings.every((offering) => !offering.available)) {
        return t('Coming soon');
    }

    const maxAllowed = Math.max(
        ...category.offerings.map((offering) => offering.maxPhotos ?? Infinity),
    );

    return printShop.photoCount > maxAllowed
        ? t('Only with 1 photo')
        : t('Pick more photos');
}

function formatPrice(amountMinor: number): string {
    return new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency: 'EUR',
    }).format(amountMinor / 100);
}

const photoCountLabel = computed(() =>
    printShop.photoCount === 1
        ? t('1 photo selected')
        : t(':count photos selected', { count: printShop.photoCount }),
);

// Scrapbook treatment: each polaroid leans a little, alternating sides.
function photoRotation(index: number): string {
    const angles = [-2.5, 1.8, -1.2, 2.4, -1.8, 1.2];

    return `rotate(${angles[index % angles.length]}deg)`;
}

// Catalog loading: without it nothing can be ordered, so failures get an
// explicit retry instead of a silent fallback.
const catalogError = ref(false);

async function loadCatalog(): Promise<void> {
    catalogError.value = false;

    try {
        await printShop.ensureCatalog();
    } catch {
        catalogError.value = true;
    }
}

// Product chooser per category: pick the concrete product, then its options
// (size, color), then add to the order.
const openCategory = ref<AppProductId | null>(null);
const chosenOptions = reactive<Record<string, string>>({});

const openCategoryOfferings = computed(() =>
    openCategory.value === null
        ? []
        : printShop.offerings.filter(
              (offering) => offering.appProduct === openCategory.value,
          ),
);

function clearChosenOptions(): void {
    Object.keys(chosenOptions).forEach((key) => delete chosenOptions[key]);
}

function showCategory(category: CategoryCard): void {
    if (category.selectable.length === 0) {
        return;
    }

    haptics.impactLight();
    clearChosenOptions();
    // A single product needs no extra tap; preselect it.
    printShop.selectedOfferingId =
        category.selectable.length === 1 ? category.selectable[0].id : null;
    openCategory.value = category.appProduct;
}

function onCategorySheetToggle(open: boolean): void {
    if (!open) {
        openCategory.value = null;
        printShop.selectedOfferingId = null;
        clearChosenOptions();
    }
}

function pickOffering(offering: PrintOffering): void {
    if (!printShop.isSelectable(offering)) {
        return;
    }

    haptics.impactLight();
    clearChosenOptions();
    printShop.selectOffering(offering.id);
}

const allOptionsChosen = computed(() =>
    (printShop.selectedOffering?.userOptions ?? []).every(
        (option) => (chosenOptions[option.attribute] ?? '') !== '',
    ),
);

const canAddToOrder = computed(
    () => printShop.selectedOffering !== null && allOptionsChosen.value,
);

function confirmAddToOrder(): void {
    const offering = printShop.selectedOffering;

    if (offering === null || !allOptionsChosen.value) {
        return;
    }

    haptics.impactMedium();
    printShop.addToCart(displayName(offering.name, offering.appProduct), {
        ...chosenOptions,
    });
    openCategory.value = null;
    clearChosenOptions();
}

function optionsLabel(options: Record<string, string>): string {
    return Object.entries(options)
        .map(([attribute, value]) => `${attribute} ${value}`)
        .join(', ');
}

/**
 * Off to pick photos for the next product: re-arm the feed's print
 * selection so the user lands directly in picking mode. The cart stays.
 */
function addMorePhotos(): void {
    feedSelection.enable('print');
    void router.push({ name: 'spa.home.grid' });
}

// Checkout: one address + one payment for the whole cart.
const checkoutOpen = ref(false);

const address = reactive({
    firstName: '',
    lastName: '',
    street: '',
    houseNumber: '',
    houseNumberAddition: '',
    postalCode: '',
    city: '',
    country: 'NL',
});

const canSubmit = computed(
    () =>
        printShop.cart.length > 0 &&
        address.firstName.trim() !== '' &&
        address.lastName.trim() !== '' &&
        address.street.trim() !== '' &&
        address.houseNumber.trim() !== '' &&
        address.postalCode.trim() !== '' &&
        address.city.trim() !== '',
);

async function openExternal(url: string): Promise<void> {
    try {
        await Browser.open(url);
    } catch {
        if (typeof window !== 'undefined') {
            window.open(url, '_blank');
        }
    }
}

async function submitCheckout(): Promise<void> {
    if (!canSubmit.value || printShop.submitting) {
        return;
    }

    try {
        const checkoutUrl = await printShop.submitOrder({
            firstName: address.firstName.trim(),
            lastName: address.lastName.trim(),
            street: address.street.trim(),
            houseNumber: address.houseNumber.trim(),
            houseNumberAddition:
                address.houseNumberAddition.trim() || undefined,
            postalCode: address.postalCode.trim(),
            city: address.city.trim(),
            country: address.country,
        });

        checkoutOpen.value = false;
        await openExternal(checkoutUrl);
    } catch {
        await Dialog.alert(
            t('Something went wrong'),
            t('Could not start the payment. Please try again.'),
        );
    }
}

const statusLabel = computed(() => {
    switch (printShop.placedOrder?.status) {
        case 'pending_payment':
            return t('Waiting for your payment');
        case 'paid':
            return t('Payment received');
        case 'submitted':
            return t('Sent to the printer');
        case 'failed':
            return t('Something went wrong, we are on it');
        case 'canceled':
            return t('Payment not completed');
        default:
            return '';
    }
});

const refreshingStatus = ref(false);

async function refreshStatus(): Promise<void> {
    if (refreshingStatus.value) {
        return;
    }

    refreshingStatus.value = true;

    try {
        await printShop.refreshPlacedOrder();
    } catch {
        // Leave the last known status in place.
    } finally {
        refreshingStatus.value = false;
    }
}

function goBack(): void {
    router.push({ name: 'spa.home.grid' });
}

onMounted(() => {
    void loadCatalog();
});

// Only the transient pick state clears on leave; the cart survives so the
// user can fetch photos for the next product without losing anything.
onUnmounted(() => {
    printShop.resetPick();
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
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col bg-sand text-ink"
    >
        <!-- Album-note atmosphere: soft brand glows plus film grain, the same
             treatment as the drawer so the shop feels like part of the album. -->
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div
                class="absolute -top-20 -right-16 size-64 rounded-full bg-brand-yellow/25 blur-3xl"
            ></div>
            <div
                class="absolute top-1/3 -left-20 size-56 rounded-full bg-accent-soft/15 blur-3xl"
            ></div>
            <div class="absolute inset-0 grain opacity-[0.035]"></div>
        </div>

        <div class="relative px-6 pt-6">
            <button
                type="button"
                class="hit-slop relative -ml-2 flex size-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand-100"
                :aria-label="t('Back')"
                @click="goBack"
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
        </div>

        <!-- Order placed: the payment finishes in the browser; this view
             tracks the order status from our own API. -->
        <div
            v-if="printShop.placedOrder"
            class="relative flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center"
        >
            <div
                aria-hidden="true"
                class="rise-in mb-5 flex size-16 items-center justify-center rounded-2xl bg-success-soft text-success-ink"
            >
                <span
                    class="inline-block size-8 bg-current"
                    :style="iconMaskStyle(tickIcon)"
                ></span>
            </div>
            <h1
                class="rise-in text-2xl font-extrabold tracking-tight text-ink"
                style="--rise: 1"
            >
                {{ t('Your order is in') }}
            </h1>
            <p class="rise-in mt-2 max-w-xs text-ink-muted" style="--rise: 2">
                {{
                    t(
                        'Finish the payment in your browser. As soon as it arrives we send your photos to the printer.',
                    )
                }}
            </p>

            <div
                class="rise-in mt-6 w-full max-w-xs rounded-2xl bg-surface p-4 text-left ring-1 ring-sand-100"
                style="--rise: 3"
            >
                <p class="text-xs tracking-widest text-ink-muted uppercase">
                    {{ t('Status') }}
                </p>
                <p class="mt-1 font-bold text-ink">{{ statusLabel }}</p>
                <ul class="mt-2 space-y-1">
                    <li
                        v-for="item in printShop.placedOrder.items"
                        :key="item.id"
                        class="flex items-baseline justify-between gap-2 text-sm text-ink-muted"
                    >
                        <span class="truncate">
                            {{ displayName(item.name, item.app_product) }}
                            <template v-if="item.options">
                                ({{ optionsLabel(item.options) }})
                            </template>
                        </span>
                        <span class="shrink-0">{{
                            formatPrice(item.amount_minor)
                        }}</span>
                    </li>
                </ul>
                <p
                    v-if="printShop.placedOrder.printdeal_order_number"
                    class="mt-2 text-sm text-ink-muted"
                >
                    {{
                        t('Order number: :number', {
                            number: printShop.placedOrder
                                .printdeal_order_number,
                        })
                    }}
                </p>
            </div>

            <div class="rise-in mt-6 flex gap-3" style="--rise: 4">
                <Button
                    variant="secondary"
                    size="md"
                    :loading="refreshingStatus"
                    @click="refreshStatus"
                >
                    {{ t('Refresh status') }}
                </Button>
                <Button variant="primary" size="md" @click="goBack">
                    {{ t('Back to the feed') }}
                </Button>
            </div>
        </div>

        <div
            v-else-if="
                printShop.photoCount === 0 && printShop.cart.length === 0
            "
            class="relative flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center"
        >
            <div
                aria-hidden="true"
                class="mb-5 flex size-16 items-center justify-center rounded-2xl bg-brand-yellow text-brand-blue"
            >
                <span
                    class="inline-block size-8 bg-current"
                    :style="iconMaskStyle(photoIcon)"
                ></span>
            </div>
            <h1 class="text-2xl font-extrabold tracking-tight text-ink">
                {{ t('No photos selected yet') }}
            </h1>
            <p class="mt-2 max-w-xs text-ink-muted">
                {{
                    t(
                        'Select photos in your feed and turn them into a calendar, album, mug, t-shirt or puzzle.',
                    )
                }}
            </p>
            <Button variant="primary" size="lg" class="mt-6" @click="goBack">
                {{ t('Back to the feed') }}
            </Button>
        </div>

        <template v-else>
            <div
                class="relative flex-1 overflow-y-auto pb-[calc(7rem+var(--inset-bottom,0px))]"
            >
                <div class="px-6 pt-4">
                    <h1
                        class="rise-in text-3xl font-extrabold tracking-tight text-ink"
                    >
                        {{ t('Printed keepsakes') }}
                    </h1>
                    <p class="rise-in mt-2 text-ink-muted" style="--rise: 1">
                        {{
                            t(
                                'Turn your favourite moments into something to hold on to.',
                            )
                        }}
                    </p>
                </div>

                <!-- The order so far. Lives at the top so it is obvious that
                     adding the next product never replaces the previous one. -->
                <div v-if="printShop.cart.length > 0" class="mt-7 px-6">
                    <h2
                        class="text-xs font-semibold tracking-widest text-ink-muted uppercase"
                    >
                        {{ t('Your order') }}
                    </h2>
                    <div
                        class="mt-3 divide-y divide-sand-100 rounded-2xl bg-surface ring-1 ring-sand-100"
                    >
                        <div
                            v-for="item in printShop.cart"
                            :key="item.id"
                            class="flex items-center gap-3 p-3"
                        >
                            <span
                                aria-hidden="true"
                                class="flex size-10 shrink-0 items-center justify-center rounded-xl"
                                :class="categoryMeta[item.appProduct].tile"
                            >
                                <span
                                    class="inline-block size-6 bg-current"
                                    :style="
                                        iconMaskStyle(
                                            categoryMeta[item.appProduct].icon,
                                        )
                                    "
                                ></span>
                            </span>
                            <div class="min-w-0 flex-1">
                                <p class="truncate font-semibold text-ink">
                                    {{ item.name }}
                                </p>
                                <p class="text-xs text-ink-muted">
                                    {{
                                        item.photos.length === 1
                                            ? t('1 photo')
                                            : t(':count photos', {
                                                  count: item.photos.length,
                                              })
                                    }}<template
                                        v-if="
                                            Object.keys(item.options).length > 0
                                        "
                                        >,
                                        {{ optionsLabel(item.options) }}
                                    </template>
                                </p>
                            </div>
                            <span
                                class="shrink-0 text-sm font-semibold text-ink"
                            >
                                {{ formatPrice(item.priceMinor) }}
                            </span>
                            <button
                                type="button"
                                class="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sand-100"
                                :aria-label="t('Remove from order')"
                                @click="printShop.removeCartItem(item.id)"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-3.5 bg-current"
                                    :style="iconMaskStyle(crossIcon)"
                                ></span>
                            </button>
                        </div>
                    </div>
                </div>

                <template v-if="printShop.photoCount > 0">
                    <div class="mt-7">
                        <div class="flex items-baseline justify-between px-6">
                            <h2
                                class="text-xs font-semibold tracking-widest text-ink-muted uppercase"
                            >
                                {{ t('Your photos') }}
                            </h2>
                            <span class="text-xs text-ink-muted">{{
                                photoCountLabel
                            }}</span>
                        </div>
                        <!-- Scrapbook strip: polaroid frames that lean a
                             little, scrolling off the page edge. -->
                        <div
                            class="mt-3 flex gap-3 overflow-x-auto px-6 pt-2 pb-4 [-webkit-overflow-scrolling:touch]"
                        >
                            <div
                                v-for="(photo, index) in printShop.photos"
                                :key="photo.id"
                                class="rise-in relative shrink-0 rounded-lg bg-white p-1.5 pb-5 shadow-md ring-1 ring-sand-200/60"
                                :style="{
                                    transform: photoRotation(index),
                                    '--rise': String(Math.min(index, 6) + 1),
                                }"
                            >
                                <img
                                    :src="photo.previewUrl"
                                    :alt="t('Photo')"
                                    class="size-24 rounded-sm object-cover"
                                    loading="lazy"
                                />
                                <button
                                    type="button"
                                    class="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-ink text-white shadow-sm transition-transform hover:scale-110"
                                    :aria-label="t('Remove photo')"
                                    @click="printShop.removePhoto(photo.id)"
                                >
                                    <span
                                        aria-hidden="true"
                                        class="inline-block size-3 bg-current"
                                        :style="iconMaskStyle(crossIcon)"
                                    ></span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 px-6">
                        <h2
                            class="text-xs font-semibold tracking-widest text-ink-muted uppercase"
                        >
                            {{ t('Choose your product') }}
                        </h2>

                        <div
                            v-if="printShop.catalog === null && !catalogError"
                            class="flex items-center justify-center py-10"
                        >
                            <LoadingSpinner />
                        </div>

                        <div v-else-if="catalogError" class="py-8 text-center">
                            <p class="text-ink-muted">
                                {{
                                    t(
                                        'Could not load the products. Check your connection.',
                                    )
                                }}
                            </p>
                            <Button
                                variant="secondary"
                                size="md"
                                class="mt-3"
                                @click="loadCatalog"
                            >
                                {{ t('Try again') }}
                            </Button>
                        </div>

                        <div v-else class="mt-3 grid grid-cols-2 gap-3">
                            <button
                                v-for="(category, index) in categories"
                                :key="category.appProduct"
                                type="button"
                                class="rise-in relative flex flex-col items-start rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-sand-100 transition-all"
                                :style="{ '--rise': String(index + 2) }"
                                :class="
                                    category.selectable.length > 0
                                        ? 'hover:-translate-y-0.5'
                                        : 'opacity-50'
                                "
                                :disabled="category.selectable.length === 0"
                                @click="showCategory(category)"
                            >
                                <span
                                    aria-hidden="true"
                                    class="flex size-12 items-center justify-center rounded-xl"
                                    :class="
                                        categoryMeta[category.appProduct].tile
                                    "
                                >
                                    <span
                                        class="inline-block size-7 bg-current"
                                        :style="
                                            iconMaskStyle(
                                                categoryMeta[
                                                    category.appProduct
                                                ].icon,
                                            )
                                        "
                                    ></span>
                                </span>
                                <span class="mt-3 font-bold text-ink">{{
                                    categoryMeta[category.appProduct].label()
                                }}</span>
                                <span
                                    class="mt-1 text-xs leading-snug text-ink-muted"
                                >
                                    {{
                                        categoryMeta[
                                            category.appProduct
                                        ].description()
                                    }}
                                </span>
                                <template v-if="category.selectable.length > 0">
                                    <span
                                        class="mt-3 text-sm font-semibold text-ink"
                                    >
                                        {{
                                            category.selectable.length === 1
                                                ? formatPrice(
                                                      category.fromPriceMinor ??
                                                          0,
                                                  )
                                                : t('from :price', {
                                                      price: formatPrice(
                                                          category.fromPriceMinor ??
                                                              0,
                                                      ),
                                                  })
                                        }}
                                    </span>
                                    <span
                                        v-if="category.selectable.length > 1"
                                        class="mt-1 text-xs text-ink-muted"
                                    >
                                        {{
                                            t(':count versions', {
                                                count: category.selectable
                                                    .length,
                                            })
                                        }}
                                    </span>
                                </template>
                                <span
                                    v-else
                                    class="mt-3 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink-subtle"
                                >
                                    {{ categoryUnavailableReason(category) }}
                                </span>
                            </button>
                        </div>
                    </div>
                </template>
            </div>

            <div
                class="fixed right-[var(--inset-right,0)] bottom-0 left-[var(--inset-left,0)] z-50 flex items-center gap-4 border-t border-dark-sand bg-sand/90 px-6 pt-3 pb-[calc(0.75rem+var(--inset-bottom,0px))] backdrop-blur-md"
            >
                <template v-if="printShop.cart.length > 0">
                    <div class="min-w-0 flex-1">
                        <p class="font-bold text-ink">
                            {{ formatPrice(printShop.cartTotalMinor) }}
                        </p>
                        <button
                            type="button"
                            class="text-sm text-ink-muted underline-offset-2 hover:underline"
                            @click="addMorePhotos"
                        >
                            {{ t('Add more photos') }}
                        </button>
                    </div>
                    <Button
                        variant="primary"
                        size="lg"
                        @click="checkoutOpen = true"
                    >
                        {{ t('Checkout') }}
                    </Button>
                </template>

                <p v-else class="text-sm text-ink-muted">
                    {{ t('Choose your product') }}
                </p>
            </div>
        </template>

        <!-- Product chooser: the concrete products within a category, then
             their options (size, color), then into the order. -->
        <BottomSheet
            :open="openCategory !== null"
            @update:open="onCategorySheetToggle"
        >
            <template #header>
                <SheetHeader
                    :title="
                        openCategory !== null
                            ? categoryMeta[openCategory].label()
                            : ''
                    "
                    @close="onCategorySheetToggle(false)"
                />
            </template>

            <div class="space-y-5 px-4 py-4">
                <div class="space-y-2">
                    <button
                        v-for="offering in openCategoryOfferings"
                        :key="offering.id"
                        type="button"
                        class="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-all"
                        :class="[
                            printShop.selectedOfferingId === offering.id
                                ? 'ring-2 ring-action'
                                : 'ring-1 ring-sand-100',
                            printShop.isSelectable(offering)
                                ? ''
                                : 'opacity-50',
                        ]"
                        :disabled="!printShop.isSelectable(offering)"
                        :aria-pressed="
                            printShop.selectedOfferingId === offering.id
                        "
                        @click="pickOffering(offering)"
                    >
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-semibold text-ink">
                                {{
                                    displayName(
                                        offering.name,
                                        offering.appProduct,
                                    )
                                }}
                            </p>
                            <p
                                v-if="!printShop.isSelectable(offering)"
                                class="text-xs text-ink-muted"
                            >
                                {{
                                    offering.available
                                        ? t('Only with 1 photo')
                                        : t('Coming soon')
                                }}
                            </p>
                        </div>
                        <span class="shrink-0 text-sm font-semibold text-ink">
                            {{ formatPrice(offering.priceMinor ?? 0) }}
                        </span>
                        <span
                            aria-hidden="true"
                            class="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors"
                            :class="
                                printShop.selectedOfferingId === offering.id
                                    ? 'bg-action text-white'
                                    : 'bg-sand-100'
                            "
                        >
                            <svg
                                v-if="
                                    printShop.selectedOfferingId === offering.id
                                "
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="3"
                                stroke="currentColor"
                                class="size-3.5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="m4.5 12.75 6 6 9-13.5"
                                />
                            </svg>
                        </span>
                    </button>
                </div>

                <div
                    v-for="option in printShop.selectedOffering?.userOptions ??
                    []"
                    :key="option.attribute"
                >
                    <p class="mb-2 text-sm font-semibold text-ink">
                        {{ option.attribute }}
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="value in option.values"
                            :key="value"
                            type="button"
                            class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                            :class="
                                chosenOptions[option.attribute] === value
                                    ? 'bg-action text-white'
                                    : 'bg-surface text-ink ring-1 ring-sand-200'
                            "
                            :aria-pressed="
                                chosenOptions[option.attribute] === value
                            "
                            @click="chosenOptions[option.attribute] = value"
                        >
                            {{ value }}
                        </button>
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="px-4 pt-3">
                    <Button
                        variant="primary"
                        size="lg"
                        block
                        :disabled="!canAddToOrder"
                        @click="confirmAddToOrder"
                    >
                        {{ t('Add to order') }}
                    </Button>
                </div>
            </template>
        </BottomSheet>

        <!-- Checkout: summary + delivery address + one payment for it all. -->
        <BottomSheet :open="checkoutOpen" @update:open="checkoutOpen = $event">
            <template #header>
                <SheetHeader
                    :title="t('Your order')"
                    :count="printShop.cart.length"
                    @close="checkoutOpen = false"
                />
            </template>

            <div class="space-y-5 px-4 py-4">
                <div
                    class="divide-y divide-sand-100 rounded-2xl bg-surface ring-1 ring-sand-100"
                >
                    <div
                        v-for="item in printShop.cart"
                        :key="item.id"
                        class="flex items-baseline justify-between gap-3 p-3"
                    >
                        <p class="min-w-0 truncate text-sm text-ink">
                            {{ item.name }}
                            <span
                                v-if="Object.keys(item.options).length > 0"
                                class="text-ink-muted"
                            >
                                ({{ optionsLabel(item.options) }})</span
                            >
                        </p>
                        <span class="shrink-0 text-sm font-semibold text-ink">
                            {{ formatPrice(item.priceMinor) }}
                        </span>
                    </div>
                    <div class="flex items-baseline justify-between gap-3 p-3">
                        <p class="text-sm font-bold text-ink">
                            {{ t('Total') }}
                        </p>
                        <span class="shrink-0 font-bold text-ink">
                            {{ formatPrice(printShop.cartTotalMinor) }}
                        </span>
                    </div>
                </div>

                <div>
                    <p class="mb-2 text-sm font-semibold text-ink">
                        {{ t('Delivery address') }}
                    </p>
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-3">
                            <TextField
                                v-model="address.firstName"
                                :placeholder="t('First name')"
                                autocomplete="given-name"
                                autocapitalize="words"
                            />
                            <TextField
                                v-model="address.lastName"
                                :placeholder="t('Last name')"
                                autocomplete="family-name"
                                autocapitalize="words"
                            />
                        </div>
                        <TextField
                            v-model="address.street"
                            :placeholder="t('Street')"
                            autocomplete="address-line1"
                            autocapitalize="words"
                        />
                        <div class="grid grid-cols-2 gap-3">
                            <TextField
                                v-model="address.houseNumber"
                                :placeholder="t('House number')"
                            />
                            <TextField
                                v-model="address.houseNumberAddition"
                                :placeholder="t('Addition (optional)')"
                            />
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <TextField
                                v-model="address.postalCode"
                                :placeholder="t('Postal code')"
                                autocomplete="postal-code"
                            />
                            <TextField
                                v-model="address.city"
                                :placeholder="t('City')"
                                autocomplete="address-level2"
                                autocapitalize="words"
                            />
                        </div>
                        <div class="flex gap-2">
                            <button
                                v-for="country in printShop.shippingCountries"
                                :key="country"
                                type="button"
                                class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                                :class="
                                    address.country === country
                                        ? 'bg-action text-white'
                                        : 'bg-surface text-ink ring-1 ring-sand-200'
                                "
                                :aria-pressed="address.country === country"
                                @click="address.country = country"
                            >
                                {{
                                    country === 'NL'
                                        ? t('Netherlands')
                                        : country === 'BE'
                                          ? t('Belgium')
                                          : country
                                }}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-3 px-1 text-ink-muted">
                    <span
                        aria-hidden="true"
                        class="inline-block size-5 shrink-0 bg-current"
                        :style="iconMaskStyle(truckIcon)"
                    ></span>
                    <p class="text-sm">
                        {{ t('Printed with love and delivered to your door.') }}
                    </p>
                </div>
            </div>

            <template #footer>
                <div class="px-4 pt-3">
                    <Button
                        variant="primary"
                        size="lg"
                        block
                        :disabled="!canSubmit"
                        :loading="printShop.submitting"
                        @click="submitCheckout"
                    >
                        {{
                            t('Pay :price', {
                                price: formatPrice(printShop.cartTotalMinor),
                            })
                        }}
                    </Button>
                </div>
            </template>
        </BottomSheet>
    </div>
</template>

<style scoped>
/* Staggered entrance: each block rises in slightly after the previous one,
   giving the shop a single orchestrated reveal instead of a hard cut. */
.rise-in {
    animation: rise-in 0.45s var(--ease-spring-soft, ease-out) both;
    animation-delay: calc(var(--rise, 0) * 60ms);
}

@keyframes rise-in {
    from {
        opacity: 0;
        translate: 0 0.75rem;
    }
    to {
        opacity: 1;
        translate: 0 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .rise-in {
        animation: none;
    }
}
</style>
