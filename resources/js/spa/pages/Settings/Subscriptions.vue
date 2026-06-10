<script setup lang="ts">
import { Browser } from '@nativephp/mobile';
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import Confetti from '@/components/Confetti.vue';
import IconTile from '@/components/IconTile.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError, externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useAuthStore } from '@/spa/stores/auth';
import { useI18nStore } from '@/spa/stores/i18n';
import {
    products as fetchProducts,
    purchase as buyProduct,
    restore as restorePurchases,
    entitlement as checkEntitlement,
} from '../../../../../vendor/developernauts/nativephp-inapp-purchases/resources/js/index.js';
import crownIcon from '../../../../svg/doodle-icons/crown.svg';
import diamondIcon from '../../../../svg/doodle-icons/diamond.svg';
import foldedHandsIcon from '../../../../svg/doodle-icons/folded-hands.svg';
import sparkleIcon from '../../../../svg/doodle-icons/star.svg';

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

type NativeTransaction = {
    purchaseToken?: string;
    productId?: string;
    originalId?: number | string;
    id?: number | string;
};

type Tier = {
    key: 'pro' | 'plus';
    title: string;
    description: string;
    icon: string;
    monthly?: Product;
    yearly?: Product;
};

const APPLE_PRODUCT_IDS = [
    'pro_apple_yearly',
    'pro_apple_monthly',
    'plus_apple_yearly',
    'plus_apple_monthly',
];

const GOOGLE_PRODUCT_IDS = [
    'pro_google_yearly',
    'pro_google_monthly',
    'plus_google_yearly',
    'plus_google_monthly',
];

const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
const GOOGLE_MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

const SHOW_DEBUG =
    (import.meta.env.VITE_APP_ENV ?? 'production') !== 'production';

const { t } = useTranslations();
const i18n = useI18nStore();
const auth = useAuthStore();
const router = useRouter();
const { isIos, isAndroid } = usePlatform();

const platform = computed<'apple' | 'google'>(() =>
    isAndroid.value && !isIos.value ? 'google' : 'apple',
);

const PRODUCT_IDS = computed(() =>
    platform.value === 'google' ? GOOGLE_PRODUCT_IDS : APPLE_PRODUCT_IDS,
);

const MANAGE_SUBSCRIPTIONS_URL = computed(() =>
    platform.value === 'google' ? GOOGLE_MANAGE_URL : APPLE_MANAGE_URL,
);

const renewalDisclaimer = computed(() =>
    platform.value === 'google'
        ? t(
              'Subscriptions automatically renew at the end of each billing period unless cancelled at least 24 hours before. Your Google account will be charged for renewal at the same price. You can manage and cancel your subscription in the Google Play account settings.',
          )
        : t(
              'Subscriptions automatically renew at the end of each billing period unless cancelled at least 24 hours before. Your Apple ID will be charged for renewal at the same price. You can manage and cancel your subscription in the App Store account settings.',
          ),
);

const logPrefix = computed(() =>
    platform.value === 'google'
        ? '[GoogleSubscriptions]'
        : '[AppleSubscriptions]',
);

const productList = ref<Product[]>([]);
const entitlements = ref<Entitlement[]>([]);
const isPremium = ref(false);
const showConfetti = ref(false);
const isLoading = ref(true);
const purchasingId = ref<string | null>(null);
const isRestoring = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const debugRaw = ref<string | null>(null);
const purchaseDebug = ref<{
    label: string;
    outcome: 'success' | 'cancelled' | 'error';
    payload: string;
} | null>(null);
const selectedPeriod = ref<Record<'pro' | 'plus', 'monthly' | 'yearly'>>({
    pro: 'monthly',
    plus: 'monthly',
});

const termsUrl = computed(() =>
    i18n.locale === 'nl'
        ? 'https://innerr.app/nl/voorwaarden/'
        : 'https://innerr.app/en/terms/',
);
const privacyUrl = computed(() =>
    i18n.locale === 'nl'
        ? 'https://innerr.app/nl/privacy/'
        : 'https://innerr.app/en/privacy/',
);

function findProduct(id: string): Product | undefined {
    return productList.value.find((product) => product.id === id);
}

const tiers = computed<Tier[]>(() => {
    const suffix = platform.value === 'google' ? 'google' : 'apple';

    return [
        {
            key: 'plus',
            title: t('Gezin'),
            description: t('100 GB storage for your photos and videos.'),
            icon: diamondIcon,
            monthly: findProduct(`plus_${suffix}_monthly`),
            yearly: findProduct(`plus_${suffix}_yearly`),
        },
        {
            key: 'pro',
            title: t('Familie+'),
            description: t('1 TB storage for your photos and videos.'),
            icon: crownIcon,
            monthly: findProduct(`pro_${suffix}_monthly`),
            yearly: findProduct(`pro_${suffix}_yearly`),
        },
    ];
});

const activeEntitlement = computed(() => entitlements.value[0] ?? null);

function goBack(): void {
    router.push({ name: 'spa.home' });
}

function goToInnerGives(): void {
    router.push({ name: 'spa.settings.give' });
}

function clearStatus(): void {
    message.value = null;
    errorMessage.value = null;
}

type ProductsResponse = { products?: Product[] };
type EntitlementResponse = {
    is_premium?: boolean;
    entitlements?: Entitlement[];
};
type ApiSubscriptionResponse = { is_paid?: boolean };

async function loadProducts(): Promise<void> {
    try {
        const result = (await fetchProducts(
            PRODUCT_IDS.value,
        )) as ProductsResponse;

        if (SHOW_DEBUG) {
            console.log(`${logPrefix.value} products result`, result);
            debugRaw.value = JSON.stringify(result, null, 2);
        }

        productList.value = result.products ?? [];
    } catch (err) {
        const e = err as { code?: string; message?: string; data?: unknown };

        if (SHOW_DEBUG) {
            console.error(`${logPrefix.value} products error`, e);
            debugRaw.value = JSON.stringify(
                { code: e.code, message: e.message, data: e.data },
                null,
                2,
            );
        }

        const code = SHOW_DEBUG && e.code ? ` (${e.code})` : '';
        errorMessage.value =
            (e.message ?? t('Could not load purchases.')) + code;
    }
}

async function verifyGooglePurchase(
    transaction: NativeTransaction,
    fallbackProductId: string,
): Promise<boolean> {
    if (platform.value !== 'google') {
        return false;
    }

    const purchaseToken = transaction.purchaseToken;
    const productId = transaction.productId ?? fallbackProductId;

    if (!purchaseToken || !productId) {
        return false;
    }

    try {
        await externalApi.post('/subscription/iap/google/verify', {
            purchase_token: purchaseToken,
            product_id: productId,
        });

        return true;
    } catch (err) {
        // Een 403 betekent dat de aankoop bij een ander Innerr-account hoort
        // (Google's obfuscatedAccountId ≠ de huidige gebruiker). Webhooks
        // reconciliëren dit NIET, dus tonen we een duidelijke melding i.p.v.
        // stil te falen.
        if (err instanceof ApiError && err.status === 403) {
            errorMessage.value = t(
                'This purchase is linked to a different Innerr account. Sign in with that account to use it.',
            );

            return false;
        }

        // Andere fouten (netwerk e.d.): Google Play RTDN-webhooks vangen het
        // uiteindelijk alsnog op, dus we falen niet hard — refreshEntitlement
        // laat de juiste (mogelijk nog niet-paid) state zien.
        return false;
    }
}

async function verifyApplePurchase(
    transaction: NativeTransaction,
): Promise<boolean> {
    if (platform.value !== 'apple') {
        return false;
    }

    // De IAP-bridge exposeert geen JWS — we sturen alleen de originalId.
    // De API doet de daadwerkelijke verificatie via de App Store Server API.
    const rawId = transaction.originalId ?? transaction.id;
    const originalTransactionId =
        rawId === undefined || rawId === null ? '' : String(rawId);

    if (!originalTransactionId || originalTransactionId === '0') {
        return false;
    }

    try {
        await externalApi.post('/subscription/iap/apple/verify', {
            original_transaction_id: originalTransactionId,
        });

        return true;
    } catch (err) {
        // Een 403 betekent dat de aankoop bij een ander Innerr-account hoort
        // (Apple's appAccountToken ≠ de huidige gebruiker). Apple App Store
        // Server Notifications reconciliëren dit NIET, dus tonen we een
        // duidelijke melding i.p.v. stil te falen.
        if (err instanceof ApiError && err.status === 403) {
            errorMessage.value = t(
                'This purchase is linked to a different Innerr account. Sign in with that account to use it.',
            );

            return false;
        }

        // Andere fouten (netwerk e.d.): Apple App Store Server Notifications
        // vangen het alsnog op.
        return false;
    }
}

async function refreshEntitlement(): Promise<void> {
    try {
        const result = (await checkEntitlement()) as EntitlementResponse;
        entitlements.value = result.entitlements ?? [];
    } catch {
        // Niet kritiek voor de UI; laat huidige waarde staan.
    }

    // De native StoreKit/Billing-laag kan stale/sandbox/family-shared
    // entitlements rapporteren die niet horen bij een echt abonnement.
    // De backend is de single source of truth: een subscription wordt pas
    // 'paid' nadat Apple/Google webhooks of receipt-verificatie bevestigen.
    try {
        const sub =
            await externalApi.get<ApiSubscriptionResponse>('/subscription/me');
        isPremium.value = Boolean(sub.is_paid);
    } catch {
        isPremium.value = false;
    }
}

async function purchase(productId: string): Promise<void> {
    if (purchasingId.value) {
        return;
    }

    clearStatus();
    purchaseDebug.value = null;
    purchasingId.value = productId;
    const startedAt = new Date().toISOString();

    try {
        const appAccountToken = auth.user?.id;
        const result = (await buyProduct(
            productId,
            appAccountToken ? { appAccountToken } : {},
        )) as Record<string, unknown>;

        if (SHOW_DEBUG) {
            console.log(`${logPrefix.value} purchase result`, result);
            purchaseDebug.value = {
                label: t('Purchase debug: :id', { id: productId }),
                outcome: 'success',
                payload: JSON.stringify(
                    { startedAt, productId, appAccountToken, result },
                    null,
                    2,
                ),
            };
        }

        const purchasedTransaction = (result.transaction ??
            {}) as NativeTransaction;

        if (platform.value === 'google') {
            await verifyGooglePurchase(purchasedTransaction, productId);
        } else {
            await verifyApplePurchase(purchasedTransaction);
        }

        await refreshEntitlement();
    } catch (err) {
        const e = err as {
            code?: string;
            message?: string;
            status?: number;
            data?: unknown;
        };

        if (SHOW_DEBUG) {
            console.error(`${logPrefix.value} purchase error`, e);
            purchaseDebug.value = {
                label: t('Purchase debug: :id', { id: productId }),
                outcome: e.code === 'user_cancelled' ? 'cancelled' : 'error',
                payload: JSON.stringify(
                    {
                        startedAt,
                        productId,
                        code: e.code,
                        message: e.message,
                        status: e.status,
                        data: e.data,
                    },
                    null,
                    2,
                ),
            };
        }

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
    purchaseDebug.value = null;
    isRestoring.value = true;
    const startedAt = new Date().toISOString();

    try {
        const result = (await restorePurchases()) as Record<string, unknown>;

        if (SHOW_DEBUG) {
            console.log(`${logPrefix.value} restore result`, result);
            purchaseDebug.value = {
                label: t('Restore debug'),
                outcome: 'success',
                payload: JSON.stringify({ startedAt, result }, null, 2),
            };
        }

        message.value =
            (result.message as string | undefined) ?? t('Purchases restored.');

        const restoredTransactions = (result.transactions ??
            []) as NativeTransaction[];

        if (platform.value === 'google') {
            await Promise.all(
                restoredTransactions.map((tx) => verifyGooglePurchase(tx, '')),
            );
        } else {
            await Promise.all(
                restoredTransactions.map((tx) => verifyApplePurchase(tx)),
            );
        }

        await refreshEntitlement();
    } catch (err) {
        const e = err as {
            code?: string;
            message?: string;
            status?: number;
            data?: unknown;
        };

        if (SHOW_DEBUG) {
            console.error(`${logPrefix.value} restore error`, e);
            purchaseDebug.value = {
                label: t('Restore debug'),
                outcome: e.code === 'user_cancelled' ? 'cancelled' : 'error',
                payload: JSON.stringify(
                    {
                        startedAt,
                        code: e.code,
                        message: e.message,
                        status: e.status,
                        data: e.data,
                    },
                    null,
                    2,
                ),
            };
        }

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
    return selectedPeriod.value[tier.key] === 'yearly'
        ? tier.yearly
        : tier.monthly;
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

function formatSubscriptionLabel(productId: string): string {
    const tierMap: Record<string, string> = {
        pro: t('Familie+'),
        plus: t('Gezin'),
    };
    const periodMap: Record<string, string> = {
        monthly: t('Monthly'),
        yearly: t('Yearly'),
    };

    const parts = productId.toLowerCase().split('_');
    const tierLabel = parts.map((part) => tierMap[part]).find(Boolean);
    const periodLabel = parts.map((part) => periodMap[part]).find(Boolean);

    if (tierLabel && periodLabel) {
        return `${tierLabel} · ${periodLabel}`;
    }

    if (tierLabel) {
        return tierLabel;
    }

    return productId;
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

watch(isPremium, (value, previous) => {
    if (value && !previous) {
        showConfetti.value = true;
    }
});

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

async function refresh(): Promise<void> {
    clearStatus();
    await Promise.all([loadProducts(), refreshEntitlement()]);
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: refresh,
    containerRef,
});

onMounted(async () => {
    isLoading.value = true;
    await Promise.all([loadProducts(), refreshEntitlement()]);
    isLoading.value = false;
});
</script>

<template>
    <AppLayout ref="layout" :title="t('Subscription')">
        <Confetti :active="showConfetti" />

        <template #header-left>
            <button class="flex items-center text-ink" @click="goBack">
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
        </template>

        <div
            class="relative mt-10 min-h-full pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <section
                    v-if="isPremium"
                    class="premium-hero reveal-item relative overflow-hidden rounded-2xl bg-gradient-to-br from-sage-200 via-sand-100 to-sand-200 p-6 text-center shadow-sm"
                >
                    <span
                        aria-hidden="true"
                        class="premium-glow pointer-events-none absolute inset-0"
                    />

                    <span
                        aria-hidden="true"
                        class="sparkle sparkle-1"
                        :style="{
                            maskImage: `url(${sparkleIcon})`,
                            WebkitMaskImage: `url(${sparkleIcon})`,
                        }"
                    />
                    <span
                        aria-hidden="true"
                        class="sparkle sparkle-2"
                        :style="{
                            maskImage: `url(${sparkleIcon})`,
                            WebkitMaskImage: `url(${sparkleIcon})`,
                        }"
                    />
                    <span
                        aria-hidden="true"
                        class="sparkle sparkle-3"
                        :style="{
                            maskImage: `url(${sparkleIcon})`,
                            WebkitMaskImage: `url(${sparkleIcon})`,
                        }"
                    />
                    <span
                        aria-hidden="true"
                        class="sparkle sparkle-4"
                        :style="{
                            maskImage: `url(${sparkleIcon})`,
                            WebkitMaskImage: `url(${sparkleIcon})`,
                        }"
                    />

                    <div class="relative">
                        <div
                            class="crown-stage mx-auto flex size-24 items-center justify-center rounded-full bg-surface/70 shadow-inner"
                        >
                            <span
                                aria-hidden="true"
                                class="crown-icon block size-14 bg-action"
                                :style="{
                                    maskImage: `url(${crownIcon})`,
                                    WebkitMaskImage: `url(${crownIcon})`,
                                    maskSize: 'contain',
                                    WebkitMaskSize: 'contain',
                                    maskRepeat: 'no-repeat',
                                    WebkitMaskRepeat: 'no-repeat',
                                    maskPosition: 'center',
                                    WebkitMaskPosition: 'center',
                                }"
                            />
                        </div>

                        <h3
                            class="mt-5 font-display text-xl font-semibold text-ink"
                        >
                            {{ t('You are a premium member') }}
                        </h3>
                        <p class="mx-auto mt-2 max-w-xs text-ink">
                            {{
                                t(
                                    'Thanks for supporting Innerr. Enjoy all premium features.',
                                )
                            }}
                        </p>

                        <div
                            v-if="
                                activeEntitlement?.productId ||
                                activeEntitlement?.expirationDate
                            "
                            class="mx-auto mt-5 inline-flex flex-col items-center gap-1 rounded-full bg-surface/60 px-4 py-2 text-ink-muted backdrop-blur-sm"
                        >
                            <span v-if="activeEntitlement?.productId">
                                {{
                                    formatSubscriptionLabel(
                                        activeEntitlement.productId,
                                    )
                                }}
                            </span>
                            <span v-if="activeEntitlement?.expirationDate">
                                {{
                                    t('Renews on :date', {
                                        date: new Date(
                                            activeEntitlement.expirationDate,
                                        ).toLocaleDateString(),
                                    })
                                }}
                            </span>
                        </div>

                        <Button
                            variant="secondary"
                            size="md"
                            block
                            class="mt-6"
                            @click="openExternal(MANAGE_SUBSCRIPTIONS_URL)"
                        >
                            {{ t('Manage subscription') }}
                        </Button>
                    </div>
                </section>

                <SurfaceCard v-if="isPremium" class="reveal-item">
                    <div class="flex items-start gap-4">
                        <IconTile
                            :icon="foldedHandsIcon"
                            size="md"
                            tone="sage"
                        />
                        <div class="min-w-0 flex-1">
                            <h3
                                class="font-display text-xl font-semibold text-ink"
                            >
                                {{ t('Inner Gives') }}
                            </h3>
                            <p class="mt-1 leading-relaxed text-ink">
                                {{
                                    t(
                                        "Innerr donates 10% of every paid subscription to a Dutch foundation for children's care.",
                                    )
                                }}
                            </p>
                            <Button
                                variant="secondary"
                                size="md"
                                class="mt-4"
                                @click="goToInnerGives"
                            >
                                {{ t('Open Inner Gives') }}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>

                <template v-else>
                    <div v-if="isLoading" class="space-y-4">
                        <div
                            class="h-48 animate-pulse rounded-2xl bg-sand-100"
                        />
                        <div
                            class="h-48 animate-pulse rounded-2xl bg-sand-100"
                        />
                    </div>

                    <div
                        v-else-if="productList.length === 0"
                        class="space-y-3 rounded-lg bg-sand-100/70 p-4 text-ink-muted"
                    >
                        <p>{{ t('No products available right now.') }}</p>
                        <details v-if="SHOW_DEBUG">
                            <summary class="cursor-pointer">
                                {{ t('Debug info') }}
                            </summary>
                            <p class="mt-2">
                                {{ t('Requested product IDs:') }}
                            </p>
                            <ul class="ml-4 list-disc">
                                <li v-for="id in PRODUCT_IDS" :key="id">
                                    <code>{{ id }}</code>
                                </li>
                            </ul>
                            <p v-if="errorMessage" class="mt-2">
                                {{ t('Bridge error:') }}
                            </p>
                            <p v-if="errorMessage">
                                <code>{{ errorMessage }}</code>
                            </p>
                            <p v-if="debugRaw" class="mt-2">
                                {{ t('Raw response:') }}
                            </p>
                            <pre
                                v-if="debugRaw"
                                class="mt-1 max-h-60 overflow-auto rounded bg-sand-200/60 p-2"
                                >{{ debugRaw }}</pre
                            >
                        </details>
                    </div>

                    <SurfaceCard
                        v-for="tier in tiers"
                        v-else
                        :key="tier.key"
                        class="reveal-item"
                    >
                        <h3 class="font-display text-lg font-semibold text-ink">
                            {{ tier.title }}
                        </h3>
                        <p class="mt-1 text-ink">
                            {{ tier.description }}
                        </p>

                        <div
                            v-if="tier.monthly && tier.yearly"
                            class="mt-4 flex items-center gap-1 rounded-full bg-sand-100/70 p-0.5"
                        >
                            <button
                                type="button"
                                class="flex-1 rounded-full px-3 py-2 transition"
                                :class="
                                    selectedPeriod[tier.key] === 'monthly'
                                        ? 'bg-surface text-ink shadow-sm'
                                        : 'text-ink-muted'
                                "
                                @click="selectedPeriod[tier.key] = 'monthly'"
                            >
                                {{ t('Monthly') }}
                            </button>
                            <button
                                type="button"
                                class="flex-1 rounded-full px-3 py-2 transition"
                                :class="
                                    selectedPeriod[tier.key] === 'yearly'
                                        ? 'bg-surface text-ink shadow-sm'
                                        : 'text-ink-muted'
                                "
                                @click="selectedPeriod[tier.key] = 'yearly'"
                            >
                                {{ t('Yearly') }}
                                <span
                                    v-if="
                                        yearlySavings(tier) &&
                                        yearlySavings(tier)! > 0
                                    "
                                    class="ml-1 rounded-full bg-sage-200 px-1.5 py-0.5 font-semibold text-success-ink"
                                >
                                    -{{ yearlySavings(tier) }}%
                                </span>
                            </button>
                        </div>

                        <div v-if="selectedProduct(tier)" class="mt-4">
                            <div class="flex items-baseline gap-2">
                                <span
                                    class="font-display text-2xl font-semibold text-ink"
                                >
                                    {{ selectedProduct(tier)!.price_formatted }}
                                </span>
                                <span class="text-ink-muted">
                                    {{
                                        selectedPeriod[tier.key] === 'yearly'
                                            ? t('/ year')
                                            : t('/ month')
                                    }}
                                </span>
                            </div>
                            <p
                                v-if="
                                    selectedPeriod[tier.key] === 'yearly' &&
                                    monthlyEquivalent(tier)
                                "
                                class="mt-1 text-ink-muted"
                            >
                                {{
                                    t(':price per month, billed yearly', {
                                        price: monthlyEquivalent(tier)!,
                                    })
                                }}
                            </p>
                            <p
                                v-if="selectedProduct(tier)!.introductory_offer"
                                class="mt-1 text-success-ink"
                            >
                                {{
                                    t('Start with :price for :count :unit', {
                                        price: selectedProduct(tier)!
                                            .introductory_offer!
                                            .price_formatted,
                                        count: selectedProduct(tier)!
                                            .introductory_offer!
                                            .billing_cycle_count,
                                        unit: selectedProduct(tier)!
                                            .introductory_offer!.period.unit,
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
                                        : t('Subscribe to :tier', {
                                              tier: tier.title,
                                          })
                                }}
                            </Button>
                        </div>

                        <p
                            v-else
                            class="mt-4 rounded-lg bg-sand-100/70 p-3 text-ink-muted"
                        >
                            {{ t('This plan is currently unavailable.') }}
                        </p>
                    </SurfaceCard>

                    <Button
                        variant="ghost"
                        size="md"
                        block
                        :disabled="isRestoring"
                        @click="restore"
                    >
                        {{
                            isRestoring
                                ? t('Restoring...')
                                : t('Restore purchases')
                        }}
                    </Button>

                    <p class="mt-2 text-center leading-relaxed text-ink-muted">
                        {{ renewalDisclaimer }}
                    </p>

                    <div class="flex flex-col items-center gap-2 text-center">
                        <button
                            type="button"
                            class="text-ink underline-offset-4 hover:underline"
                            @click="openExternal(termsUrl)"
                        >
                            {{ t('Terms of Use') }}
                        </button>
                        <button
                            type="button"
                            class="text-ink underline-offset-4 hover:underline"
                            @click="openExternal(privacyUrl)"
                        >
                            {{ t('Privacy Policy') }}
                        </button>
                        <button
                            type="button"
                            class="text-ink underline-offset-4 hover:underline"
                            @click="openExternal(MANAGE_SUBSCRIPTIONS_URL)"
                        >
                            {{ t('Manage subscription') }}
                        </button>
                    </div>
                </template>

                <p
                    v-if="message"
                    class="rounded-lg bg-success-soft/70 p-3 text-success-ink"
                >
                    {{ message }}
                </p>
                <p
                    v-if="errorMessage"
                    class="rounded-lg bg-destructive-soft p-3 text-destructive-ink"
                >
                    {{ errorMessage }}
                </p>

                <details
                    v-if="SHOW_DEBUG && purchaseDebug"
                    class="rounded-lg bg-sand-100/70 p-3 text-ink"
                    open
                >
                    <summary class="flex cursor-pointer items-center gap-2">
                        <span
                            class="inline-flex size-2 rounded-full"
                            :class="{
                                'bg-sage-500':
                                    purchaseDebug.outcome === 'success',
                                'bg-amber-500':
                                    purchaseDebug.outcome === 'cancelled',
                                'bg-blush-500':
                                    purchaseDebug.outcome === 'error',
                            }"
                        />
                        {{ purchaseDebug.label }}
                        <span
                            class="ml-auto tracking-wide text-ink-muted uppercase"
                        >
                            {{ purchaseDebug.outcome }}
                        </span>
                    </summary>
                    <pre
                        class="mt-2 max-h-80 overflow-auto rounded bg-sand-200/60 p-2"
                        >{{ purchaseDebug.payload }}</pre
                    >
                    <button
                        type="button"
                        class="mt-2 text-ink underline-offset-2 hover:underline"
                        @click="purchaseDebug = null"
                    >
                        {{ t('Clear debug') }}
                    </button>
                </details>
            </div>
        </div>
    </AppLayout>
</template>

<style scoped>
.premium-hero {
    isolation: isolate;
}

.premium-glow {
    background:
        radial-gradient(
            circle at 20% 0%,
            rgba(232, 199, 123, 0.35),
            transparent 55%
        ),
        radial-gradient(
            circle at 80% 100%,
            rgba(167, 197, 161, 0.35),
            transparent 55%
        );
    animation: glow-shift 8s ease-in-out infinite;
}

.crown-stage {
    animation: float 4s ease-in-out infinite;
    position: relative;
}

.crown-stage::before {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 9999px;
    background: radial-gradient(
        circle,
        rgba(232, 199, 123, 0.45),
        transparent 65%
    );
    filter: blur(8px);
    z-index: -1;
    animation: pulse-glow 3s ease-in-out infinite;
}

.crown-icon {
    transform-origin: 50% 80%;
    animation: crown-sway 5s ease-in-out infinite;
}

.sparkle {
    position: absolute;
    background-color: #e8c77b;
    mask-size: contain;
    -webkit-mask-size: contain;
    mask-repeat: no-repeat;
    -webkit-mask-repeat: no-repeat;
    mask-position: center;
    -webkit-mask-position: center;
    opacity: 0;
}

.sparkle-1 {
    top: 14%;
    left: 12%;
    width: 18px;
    height: 18px;
    animation: twinkle 3.4s ease-in-out infinite;
}

.sparkle-2 {
    top: 22%;
    right: 14%;
    width: 14px;
    height: 14px;
    animation: twinkle 2.8s ease-in-out 0.6s infinite;
}

.sparkle-3 {
    bottom: 28%;
    left: 18%;
    width: 12px;
    height: 12px;
    animation: twinkle 3.1s ease-in-out 1.1s infinite;
}

.sparkle-4 {
    bottom: 18%;
    right: 16%;
    width: 16px;
    height: 16px;
    animation: twinkle 3.7s ease-in-out 1.6s infinite;
}

@keyframes float {
    0%,
    100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-6px);
    }
}

@keyframes crown-sway {
    0%,
    100% {
        transform: rotate(-3deg) scale(1);
    }
    50% {
        transform: rotate(3deg) scale(1.04);
    }
}

@keyframes pulse-glow {
    0%,
    100% {
        opacity: 0.6;
        transform: scale(1);
    }
    50% {
        opacity: 1;
        transform: scale(1.15);
    }
}

@keyframes twinkle {
    0%,
    100% {
        opacity: 0;
        transform: scale(0.6) rotate(0deg);
    }
    50% {
        opacity: 1;
        transform: scale(1) rotate(20deg);
    }
}

@keyframes glow-shift {
    0%,
    100% {
        opacity: 0.9;
    }
    50% {
        opacity: 0.5;
    }
}

@media (prefers-reduced-motion: reduce) {
    .premium-glow,
    .crown-stage,
    .crown-stage::before,
    .crown-icon,
    .sparkle {
        animation: none;
    }

    .sparkle {
        opacity: 0.6;
    }
}
</style>
