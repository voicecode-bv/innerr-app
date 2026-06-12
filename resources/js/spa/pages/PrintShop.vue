<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import BottomSheet from '@/components/BottomSheet.vue';
import Button from '@/components/Button.vue';
import SheetHeader from '@/components/SheetHeader.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { haptics } from '@/spa/services/haptics';
import { usePrintShopStore } from '@/spa/stores/printShop';
import type { PrintProductId } from '@/spa/stores/printShop';
import { Dialog } from '@nativephp/mobile';
import bulbIcon from '../../../svg/doodle-icons/bulb.svg';
import calendarIcon from '../../../svg/doodle-icons/calendar.svg';
import coffeeCupIcon from '../../../svg/doodle-icons/coffee-cup-1.svg';
import crossIcon from '../../../svg/doodle-icons/cross.svg';
import photoIcon from '../../../svg/doodle-icons/photo.svg';
import tShirtIcon from '../../../svg/doodle-icons/t-shirt.svg';
import truckIcon from '../../../svg/doodle-icons/truck.svg';

const router = useRouter();
const { t, locale } = useTranslations();
const printShop = usePrintShopStore();

// Names and descriptions resolve through t() at render time; the catalog in
// the store stays translation-free.
const productMeta: Record<
    PrintProductId,
    {
        icon: string;
        tile: string;
        name: () => string;
        description: () => string;
    }
> = {
    calendar: {
        icon: calendarIcon,
        tile: 'bg-brand-yellow text-brand-blue',
        name: () => t('Photo calendar'),
        description: () =>
            t('Twelve months of your favourite moments on the wall.'),
    },
    album: {
        icon: photoIcon,
        tile: 'bg-brand-blue text-brand-sand',
        name: () => t('Photo album'),
        description: () =>
            t('A beautifully bound book to leaf through together.'),
    },
    mug: {
        icon: coffeeCupIcon,
        tile: 'bg-brand-orange text-white',
        name: () => t('Mug'),
        description: () => t('Start every morning with a treasured memory.'),
    },
    tshirt: {
        icon: tShirtIcon,
        tile: 'bg-sage-100 text-sage-700',
        name: () => t('T-shirt'),
        description: () => t('Wear your favourite moment wherever you go.'),
    },
};

const selectedMeta = computed(() =>
    printShop.productId ? productMeta[printShop.productId] : null,
);

function formatPrice(amount: number): string {
    return new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency: 'EUR',
    }).format(amount);
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

function selectProduct(id: PrintProductId): void {
    const product = printShop.products.find((entry) => entry.id === id);

    if (!product || !printShop.isAvailable(product)) {
        return;
    }

    haptics.impactLight();
    printShop.selectProduct(id);
}

const summaryOpen = ref(false);
const submitting = ref(false);

async function placeOrder(): Promise<void> {
    if (submitting.value) {
        return;
    }

    submitting.value = true;

    try {
        // Always 'unavailable' until the print API lands; the sheet's notice
        // has already set that expectation.
        await printShop.submitOrder();
        summaryOpen.value = false;
        await Dialog.toast(t('Ordering will be available soon.'));
    } finally {
        submitting.value = false;
    }
}

function goBack(): void {
    router.push({ name: 'spa.home.grid' });
}

// The shop owns its snapshot only while it is on screen; a fresh selection in
// the feed repopulates it.
onUnmounted(() => {
    printShop.reset();
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

        <div
            v-if="printShop.photoCount === 0"
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
                        'Select photos in your feed and turn them into a calendar, album, mug or t-shirt.',
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
                    <!-- Scrapbook strip: polaroid frames that lean a little,
                         scrolling off the page edge to invite a swipe. -->
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
                    <div class="mt-3 grid grid-cols-2 gap-3">
                        <button
                            v-for="(product, index) in printShop.products"
                            :key="product.id"
                            type="button"
                            class="rise-in relative flex flex-col items-start rounded-2xl bg-surface p-4 text-left shadow-sm transition-all"
                            :style="{ '--rise': String(index + 2) }"
                            :class="[
                                printShop.productId === product.id
                                    ? 'ring-2 ring-action'
                                    : 'ring-1 ring-sand-100',
                                printShop.isAvailable(product)
                                    ? 'hover:-translate-y-0.5'
                                    : 'opacity-50',
                            ]"
                            :disabled="!printShop.isAvailable(product)"
                            :aria-pressed="printShop.productId === product.id"
                            @click="selectProduct(product.id)"
                        >
                            <span
                                aria-hidden="true"
                                class="flex size-12 items-center justify-center rounded-xl"
                                :class="productMeta[product.id].tile"
                            >
                                <span
                                    class="inline-block size-7 bg-current"
                                    :style="
                                        iconMaskStyle(
                                            productMeta[product.id].icon,
                                        )
                                    "
                                ></span>
                            </span>
                            <span class="mt-3 font-bold text-ink">{{
                                productMeta[product.id].name()
                            }}</span>
                            <span
                                class="mt-1 text-xs leading-snug text-ink-muted"
                            >
                                {{ productMeta[product.id].description() }}
                            </span>
                            <span
                                v-if="printShop.isAvailable(product)"
                                class="mt-3 text-sm font-semibold text-ink"
                            >
                                {{
                                    t('from :price', {
                                        price: formatPrice(product.priceFrom),
                                    })
                                }}
                            </span>
                            <span
                                v-else
                                class="mt-3 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink-subtle"
                            >
                                {{ t('Only with 1 photo') }}
                            </span>

                            <span
                                v-if="printShop.productId === product.id"
                                aria-hidden="true"
                                class="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-action text-white"
                            >
                                <svg
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
                        v-if="
                            printShop.productId === 'calendar' &&
                            printShop.photoCount !== 12
                        "
                        class="mt-4 flex items-start gap-3 rounded-2xl bg-brand-yellow p-4 text-brand-blue"
                    >
                        <span
                            aria-hidden="true"
                            class="mt-0.5 inline-block size-5 shrink-0 bg-current"
                            :style="iconMaskStyle(bulbIcon)"
                        ></span>
                        <p class="text-sm font-medium">
                            {{ t('Tip: pick 12 photos, one for every month.') }}
                        </p>
                    </div>
                </div>
            </div>

            <div
                class="fixed right-[var(--inset-right,0)] bottom-0 left-[var(--inset-left,0)] z-50 flex items-center gap-4 border-t border-dark-sand bg-sand/90 px-6 pt-3 pb-[calc(0.75rem+var(--inset-bottom,0px))] backdrop-blur-md"
            >
                <div class="min-w-0 flex-1">
                    <template v-if="printShop.selectedProduct && selectedMeta">
                        <p class="truncate font-bold text-ink">
                            {{ selectedMeta.name() }}
                        </p>
                        <p class="text-sm text-ink-muted">
                            {{
                                t('from :price', {
                                    price: formatPrice(
                                        printShop.selectedProduct.priceFrom,
                                    ),
                                })
                            }}
                        </p>
                    </template>
                    <p v-else class="text-sm text-ink-muted">
                        {{ t('Choose your product') }}
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="lg"
                    :disabled="printShop.productId === null"
                    @click="summaryOpen = true"
                >
                    {{ t('Continue') }}
                </Button>
            </div>
        </template>

        <BottomSheet :open="summaryOpen" @update:open="summaryOpen = $event">
            <template #header>
                <SheetHeader
                    :title="t('Your order')"
                    @close="summaryOpen = false"
                />
            </template>

            <div
                v-if="printShop.selectedProduct && selectedMeta"
                class="space-y-4 px-4 py-4"
            >
                <div
                    class="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-sand-100"
                >
                    <span
                        aria-hidden="true"
                        class="flex size-12 shrink-0 items-center justify-center rounded-xl"
                        :class="selectedMeta.tile"
                    >
                        <span
                            class="inline-block size-7 bg-current"
                            :style="iconMaskStyle(selectedMeta.icon)"
                        ></span>
                    </span>
                    <div class="min-w-0 flex-1">
                        <p class="font-bold text-ink">
                            {{ selectedMeta.name() }}
                        </p>
                        <p class="text-sm text-ink-muted">
                            {{
                                printShop.photoCount === 1
                                    ? t('1 photo')
                                    : t(':count photos', {
                                          count: printShop.photoCount,
                                      })
                            }}
                        </p>
                    </div>
                    <p class="shrink-0 font-semibold text-ink">
                        {{
                            t('from :price', {
                                price: formatPrice(
                                    printShop.selectedProduct.priceFrom,
                                ),
                            })
                        }}
                    </p>
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

                <div class="rounded-2xl bg-brand-yellow p-4 text-brand-blue">
                    <p class="font-bold">{{ t('Almost here') }}</p>
                    <p class="mt-1 text-sm">
                        {{
                            t(
                                'Ordering from the app will be available soon. You can already pick your photos and choose a product.',
                            )
                        }}
                    </p>
                </div>
            </div>

            <template #footer>
                <div class="px-4 pt-3">
                    <Button
                        variant="primary"
                        size="lg"
                        block
                        :loading="submitting"
                        @click="placeOrder"
                    >
                        {{ t('Place order') }}
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
