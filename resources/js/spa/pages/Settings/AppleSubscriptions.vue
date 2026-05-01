<script setup lang="ts">
import { Browser } from '@nativephp/mobile';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useI18nStore } from '@/spa/stores/i18n';
import {
    products as fetchProducts,
    purchase as buyProduct,
    restore as restorePurchases,
    entitlement as checkEntitlement,
} from '../../../../../vendor/developernauts/nativephp-inapp-purchases/resources/js/index.js';
import crownIcon from '../../../../svg/doodle-icons/crown.svg';
import diamondIcon from '../../../../svg/doodle-icons/diamond.svg';

type Product = {
    id: string;
    title: string;
    description: string;
    price: number;
    price_formatted: string;
    currency: string;
    type: string;
    subscription_period?: { value: number; unit: string };
    introductory_offer?: {
        price: number;
        price_formatted: string;
        billing_cycle_count: number;
        period: { value: number; unit: string };
    } | null;
};

type Entitlement = {
    productId: string;
    expirationDate?: string | null;
    environment: string;
};

type Tier = {
    key: 'pro' | 'plus';
    title: string;
    description: string;
    icon: string;
    monthly?: Product;
    yearly?: Product;
};

const PRODUCT_IDS = [
    'pro_apple_yearly',
    'pro_apple_monthly',
    'plus_apple_yearly',
    'plus_apple_monthly',
];

const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

const { t } = useTranslations();
const i18n = useI18nStore();
const router = useRouter();

const productList = ref<Product[]>([]);
const entitlements = ref<Entitlement[]>([]);
const isPremium = ref(false);
const isLoading = ref(true);
const purchasingId = ref<string | null>(null);
const isRestoring = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const debugRaw = ref<string | null>(null);
const selectedPeriod = ref<Record<'pro' | 'plus', 'monthly' | 'yearly'>>({
    pro: 'yearly',
    plus: 'yearly',
});

const termsUrl = computed(() =>
    i18n.locale === 'nl' ? 'https://innerr.app/nl/voorwaarden/' : 'https://innerr.app/en/terms/',
);
const privacyUrl = computed(() =>
    i18n.locale === 'nl' ? 'https://innerr.app/nl/privacy/' : 'https://innerr.app/en/privacy/',
);

function findProduct(id: string): Product | undefined {
    return productList.value.find((product) => product.id === id);
}

const tiers = computed<Tier[]>(() => [
    {
        key: 'plus',
        title: t('Gezin'),
        description: t('100 GB storage for your photos and videos.'),
        icon: diamondIcon,
        monthly: findProduct('plus_apple_monthly'),
        yearly: findProduct('plus_apple_yearly'),
    },
    {
        key: 'pro',
        title: t('Familie+'),
        description: t('1 TB storage for your photos and videos.'),
        icon: crownIcon,
        monthly: findProduct('pro_apple_monthly'),
        yearly: findProduct('pro_apple_yearly'),
    },
]);

const activeEntitlement = computed(() => entitlements.value[0] ?? null);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

function clearStatus(): void {
    message.value = null;
    errorMessage.value = null;
}

type ProductsResponse = { products?: Product[] };
type EntitlementResponse = { is_premium?: boolean; entitlements?: Entitlement[] };
type MessageResponse = { message?: string };

async function loadProducts(): Promise<void> {
    try {
        const result = (await fetchProducts(PRODUCT_IDS)) as ProductsResponse;
        // eslint-disable-next-line no-console
        console.log('[AppleSubscriptions] products result', result);
        debugRaw.value = JSON.stringify(result, null, 2);
        productList.value = result.products ?? [];
    } catch (err) {
        const e = err as { code?: string; message?: string; data?: unknown };
        // eslint-disable-next-line no-console
        console.error('[AppleSubscriptions] products error', e);
        debugRaw.value = JSON.stringify({ code: e.code, message: e.message, data: e.data }, null, 2);
        const code = e.code ? ` (${e.code})` : '';
        errorMessage.value = (e.message ?? t('Could not load purchases.')) + code;
    }
}

async function refreshEntitlement(): Promise<void> {
    try {
        const result = (await checkEntitlement()) as EntitlementResponse;
        isPremium.value = Boolean(result.is_premium);
        entitlements.value = result.entitlements ?? [];
    } catch {
        // Niet kritiek voor de UI; laat huidige waarde staan.
    }
}

async function purchase(productId: string): Promise<void> {
    if (purchasingId.value) {
        return;
    }
    clearStatus();
    purchasingId.value = productId;
    try {
        const result = (await buyProduct(productId)) as MessageResponse;
        message.value = result.message ?? t('Purchase successful.');
        await refreshEntitlement();
    } catch (err) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'user_cancelled') {
            return;
        }
        errorMessage.value = e.message ?? t('Purchase failed.');
    } finally {
        purchasingId.value = null;
    }
}

async function restore(): Promise<void> {
    if (isRestoring.value) {
        return;
    }
    clearStatus();
    isRestoring.value = true;
    try {
        const result = (await restorePurchases()) as MessageResponse;
        message.value = result.message ?? t('Purchases restored.');
        await refreshEntitlement();
    } catch (err) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'user_cancelled') {
            return;
        }
        errorMessage.value = e.message ?? t('Restore failed.');
    } finally {
        isRestoring.value = false;
    }
}

async function openExternal(url: string): Promise<void> {
    try {
        await Browser.open(url);
    } catch {
        if (typeof window !== 'undefined') {
            window.open(url, '_blank');
        }
    }
}

function selectedProduct(tier: Tier): Product | undefined {
    return selectedPeriod.value[tier.key] === 'yearly' ? tier.yearly : tier.monthly;
}

function yearlySavings(tier: Tier): number | null {
    if (!tier.monthly?.price || !tier.yearly?.price) {
        return null;
    }
    const monthlyTotal = tier.monthly.price * 12;
    if (monthlyTotal <= 0) {
        return null;
    }
    const saved = ((monthlyTotal - tier.yearly.price) / monthlyTotal) * 100;
    return Math.max(0, Math.round(saved));
}

function monthlyEquivalent(tier: Tier): string | null {
    if (!tier.yearly) {
        return null;
    }
    const perMonth = tier.yearly.price / 12;
    try {
        return new Intl.NumberFormat(i18n.locale === 'nl' ? 'nl-NL' : 'en-US', {
            style: 'currency',
            currency: tier.yearly.currency || 'EUR',
            maximumFractionDigits: 2,
        }).format(perMonth);
    } catch {
        return null;
    }
}

onMounted(async () => {
    isLoading.value = true;
    await Promise.all([loadProducts(), refreshEntitlement()]);
    isLoading.value = false;
});
</script>

<template>
    <AppLayout :title="t('Subscription')">
        <template #header-left>
            <button class="flex items-center text-teal dark:text-sand-300" @click="goBack">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
            </button>
        </template>

        <div class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]">
            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <SurfaceCard v-if="isPremium">
                    <h3 class="flex items-center gap-3 text-sm font-semibold text-sand-900 dark:text-sand-100">
                        <IconTile :icon="crownIcon" size="sm" tone="sage" />
                        {{ t('You are a premium member') }}
                    </h3>
                    <p class="mt-3 text-sm text-sand-700 dark:text-sand-300">
                        {{ t('Thanks for supporting Innerr. Enjoy all premium features.') }}
                    </p>
                    <p
                        v-if="activeEntitlement?.productId"
                        class="mt-2 text-xs text-sand-500 dark:text-sand-400"
                    >
                        {{ activeEntitlement.productId }}
                    </p>
                    <p
                        v-if="activeEntitlement?.expirationDate"
                        class="text-xs text-sand-500 dark:text-sand-400"
                    >
                        {{ t('Renews on :date', { date: new Date(activeEntitlement.expirationDate).toLocaleDateString() }) }}
                    </p>

                    <Button
                        variant="secondary"
                        size="md"
                        block
                        class="mt-4"
                        @click="openExternal(MANAGE_SUBSCRIPTIONS_URL)"
                    >
                        {{ t('Manage subscription') }}
                    </Button>
                </SurfaceCard>

                <template v-else>
                    <div v-if="isLoading" class="space-y-4">
                        <div class="h-48 animate-pulse rounded-2xl bg-sand-100 dark:bg-sand-700/60" />
                        <div class="h-48 animate-pulse rounded-2xl bg-sand-100 dark:bg-sand-700/60" />
                    </div>

                    <div
                        v-else-if="productList.length === 0"
                        class="space-y-3 rounded-lg bg-sand-100/70 p-4 text-sm text-sand-600 dark:bg-sand-800/60 dark:text-sand-300"
                    >
                        <p>{{ t('No products available right now.') }}</p>
                        <details class="text-xs">
                            <summary class="cursor-pointer font-medium">{{ t('Debug info') }}</summary>
                            <p class="mt-2 font-medium">{{ t('Requested product IDs:') }}</p>
                            <ul class="ml-4 list-disc">
                                <li v-for="id in PRODUCT_IDS" :key="id"><code>{{ id }}</code></li>
                            </ul>
                            <p v-if="errorMessage" class="mt-2 font-medium">{{ t('Bridge error:') }}</p>
                            <p v-if="errorMessage"><code>{{ errorMessage }}</code></p>
                            <p v-if="debugRaw" class="mt-2 font-medium">{{ t('Raw response:') }}</p>
                            <pre v-if="debugRaw" class="mt-1 max-h-60 overflow-auto rounded bg-sand-200/60 p-2 text-[10px] dark:bg-sand-900/60">{{ debugRaw }}</pre>
                        </details>
                    </div>

                    <SurfaceCard v-for="tier in tiers" v-else :key="tier.key">
                        <div class="flex items-start gap-3">
                            <IconTile :icon="tier.icon" size="md" tone="sage" />
                            <div class="min-w-0 flex-1">
                                <h3 class="font-display text-lg font-semibold text-teal dark:text-sand-100">
                                    {{ tier.title }}
                                </h3>
                                <p class="mt-1 text-sm text-sand-700 dark:text-sand-300">{{ tier.description }}</p>
                            </div>
                        </div>

                        <div
                            v-if="tier.monthly && tier.yearly"
                            class="mt-4 flex items-center gap-1 rounded-full bg-sand-100/70 p-0.5 text-xs font-medium dark:bg-sand-800/60"
                        >
                            <button
                                type="button"
                                class="flex-1 rounded-full px-3 py-2 transition"
                                :class="selectedPeriod[tier.key] === 'yearly'
                                    ? 'bg-white text-teal shadow-sm dark:bg-sand-900 dark:text-sand-100'
                                    : 'text-sand-500 dark:text-sand-400'"
                                @click="selectedPeriod[tier.key] = 'yearly'"
                            >
                                {{ t('Yearly') }}
                                <span
                                    v-if="yearlySavings(tier) && yearlySavings(tier)! > 0"
                                    class="ml-1 rounded-full bg-sage-200 px-1.5 py-0.5 text-[10px] font-semibold text-sage-800 dark:bg-sage-800/60 dark:text-sage-100"
                                >
                                    -{{ yearlySavings(tier) }}%
                                </span>
                            </button>
                            <button
                                type="button"
                                class="flex-1 rounded-full px-3 py-2 transition"
                                :class="selectedPeriod[tier.key] === 'monthly'
                                    ? 'bg-white text-teal shadow-sm dark:bg-sand-900 dark:text-sand-100'
                                    : 'text-sand-500 dark:text-sand-400'"
                                @click="selectedPeriod[tier.key] = 'monthly'"
                            >
                                {{ t('Monthly') }}
                            </button>
                        </div>

                        <div v-if="selectedProduct(tier)" class="mt-4">
                            <div class="flex items-baseline gap-2">
                                <span class="font-display text-2xl font-semibold text-teal dark:text-sand-100">
                                    {{ selectedProduct(tier)!.price_formatted }}
                                </span>
                                <span class="text-sm text-sand-500 dark:text-sand-400">
                                    {{ selectedPeriod[tier.key] === 'yearly' ? t('/ year') : t('/ month') }}
                                </span>
                            </div>
                            <p
                                v-if="selectedPeriod[tier.key] === 'yearly' && monthlyEquivalent(tier)"
                                class="mt-1 text-xs text-sand-500 dark:text-sand-400"
                            >
                                {{ t(':price per month, billed yearly', { price: monthlyEquivalent(tier)! }) }}
                            </p>
                            <p
                                v-if="selectedProduct(tier)!.introductory_offer"
                                class="mt-1 text-xs text-sage-700 dark:text-sage-200"
                            >
                                {{
                                    t('Start with :price for :count :unit', {
                                        price: selectedProduct(tier)!.introductory_offer!.price_formatted,
                                        count: selectedProduct(tier)!.introductory_offer!.billing_cycle_count,
                                        unit: selectedProduct(tier)!.introductory_offer!.period.unit,
                                    })
                                }}
                            </p>

                            <Button
                                size="lg"
                                block
                                class="mt-4"
                                :disabled="purchasingId !== null"
                                @click="purchase(selectedProduct(tier)!.id)"
                            >
                                {{
                                    purchasingId === selectedProduct(tier)!.id
                                        ? t('Processing...')
                                        : t('Subscribe to :tier', { tier: tier.title })
                                }}
                            </Button>
                        </div>

                        <p
                            v-else
                            class="mt-4 rounded-lg bg-sand-100/70 p-3 text-xs text-sand-600 dark:bg-sand-800/60 dark:text-sand-300"
                        >
                            {{ t('This plan is currently unavailable.') }}
                        </p>
                    </SurfaceCard>

                    <Button variant="ghost" size="md" block :disabled="isRestoring" @click="restore">
                        {{ isRestoring ? t('Restoring...') : t('Restore purchases') }}
                    </Button>

                    <p class="mt-2 text-xs leading-relaxed text-sand-500 dark:text-sand-400">
                        {{ t('Subscriptions automatically renew at the end of each billing period unless cancelled at least 24 hours before. Your Apple ID will be charged for renewal at the same price. You can manage and cancel your subscription in the App Store account settings.') }}
                    </p>

                    <div class="flex items-center justify-center gap-4 text-xs">
                        <button
                            type="button"
                            class="font-medium text-teal underline-offset-4 hover:underline dark:text-sand-200"
                            @click="openExternal(termsUrl)"
                        >
                            {{ t('Terms of Use') }}
                        </button>
                        <span class="text-sand-300 dark:text-sand-600">·</span>
                        <button
                            type="button"
                            class="font-medium text-teal underline-offset-4 hover:underline dark:text-sand-200"
                            @click="openExternal(privacyUrl)"
                        >
                            {{ t('Privacy Policy') }}
                        </button>
                        <span class="text-sand-300 dark:text-sand-600">·</span>
                        <button
                            type="button"
                            class="font-medium text-teal underline-offset-4 hover:underline dark:text-sand-200"
                            @click="openExternal(MANAGE_SUBSCRIPTIONS_URL)"
                        >
                            {{ t('Manage subscription') }}
                        </button>
                    </div>
                </template>

                <p
                    v-if="message"
                    class="rounded-lg bg-sage-100/70 p-3 text-sm font-medium text-sage-700 dark:bg-sage-800/40 dark:text-sage-200"
                >
                    {{ message }}
                </p>
                <p
                    v-if="errorMessage"
                    class="rounded-lg bg-blush-50 p-3 text-sm text-blush-700 dark:bg-blush-900/30 dark:text-blush-200"
                >
                    {{ errorMessage }}
                </p>
            </div>
        </div>
    </AppLayout>
</template>
