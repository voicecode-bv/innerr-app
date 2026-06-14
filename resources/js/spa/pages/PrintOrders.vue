<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import { usePrintTerms } from '@/spa/composables/usePrintTerms';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { printOrderStatusKey } from '@/spa/stores/printShop';
import type { AppProductId, PrintOrderSummary } from '@/spa/stores/printShop';

const { t, locale } = useTranslations();
const { printTerm } = usePrintTerms();
const router = useRouter();

const orders = ref<PrintOrderSummary[] | null>(null);
const loadError = ref(false);

async function loadOrders(): Promise<void> {
    loadError.value = false;

    try {
        const response = await externalApi.get<{
            data: PrintOrderSummary[];
        }>('/print/orders');
        orders.value = response.data;
    } catch {
        loadError.value = true;
    }
}

onMounted(loadOrders);

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: loadOrders,
    containerRef,
});

function goBack(): void {
    router.push({ name: 'spa.home' });
}

const familyLabels: Record<AppProductId, () => string> = {
    calendar: () => t('Photo calendar'),
    album: () => t('Photo album'),
    mug: () => t('Mug'),
    tshirt: () => t('T-shirt'),
    puzzle: () => t('Photo puzzle'),
    canvas: () => t('Photo canvas'),
};

function itemName(
    name: Record<string, string> | null,
    appProduct: AppProductId,
): string {
    const localeKey = `${locale.value}-${locale.value.toUpperCase()}`;

    return name?.[localeKey] ?? name?.['en-EN'] ?? familyLabels[appProduct]();
}

function optionsLabel(options: Record<string, string> | null): string {
    return Object.entries(options ?? {})
        .map(
            ([attribute, value]) =>
                `${printTerm(attribute)} ${printTerm(value)}`,
        )
        .join(', ');
}

function formatPrice(amountMinor: number): string {
    return new Intl.NumberFormat(locale.value, {
        style: 'currency',
        currency: 'EUR',
    }).format(amountMinor / 100);
}

function formatDate(iso: string | null): string {
    if (iso === null) {
        return '';
    }

    return new Intl.DateTimeFormat(locale.value, {
        dateStyle: 'medium',
    }).format(new Date(iso));
}

// Badge tone per status: a quiet wait, a happy confirmation, a loud problem.
function statusClasses(status: PrintOrderSummary['status']): string {
    switch (status) {
        case 'submitted':
            return 'bg-success-soft text-success-ink';
        case 'paid':
            return 'bg-brand-yellow text-brand-blue';
        case 'failed':
            return 'bg-destructive-soft text-destructive-ink';
        default:
            return 'bg-sand-100 text-ink-subtle';
    }
}
</script>

<template>
    <AppLayout ref="layout" :title="t('Print orders')">
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

        <!-- mt-10 clears the fixed AppLayout header, same as the other
             header-bearing pages (Tags, Storage). -->
        <div
            class="relative mt-10 px-4 pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px)+1rem)]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div
                v-if="orders === null && !loadError"
                class="flex items-center justify-center py-16"
            >
                <LoadingSpinner />
            </div>

            <div v-else-if="loadError" class="py-16 text-center">
                <p class="text-ink-muted">
                    {{ t('Could not load your orders.') }}
                </p>
                <Button
                    variant="secondary"
                    size="md"
                    class="mt-3"
                    @click="loadOrders"
                >
                    {{ t('Try again') }}
                </Button>
            </div>

            <div
                v-else-if="orders !== null && orders.length === 0"
                class="px-8 py-16 text-center"
            >
                <h2 class="text-xl font-extrabold tracking-tight text-ink">
                    {{ t('No orders yet') }}
                </h2>
                <p class="mt-2 text-ink-muted">
                    {{
                        t(
                            'Your printed keepsakes will appear here after checkout.',
                        )
                    }}
                </p>
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="order in orders"
                    :key="order.id"
                    class="rounded-2xl bg-surface p-4 ring-1 ring-sand-100"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <p class="font-bold text-ink">
                                {{
                                    t('Order #:number', {
                                        number: order.number,
                                    })
                                }}
                            </p>
                            <p class="text-sm text-ink-muted">
                                {{ formatDate(order.created_at) }}
                            </p>
                        </div>
                        <span
                            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                            :class="statusClasses(order.status)"
                        >
                            {{ t(printOrderStatusKey(order.status)) }}
                        </span>
                    </div>

                    <ul class="mt-3 space-y-1.5">
                        <li
                            v-for="item in order.items"
                            :key="item.id"
                            class="flex items-baseline justify-between gap-2"
                        >
                            <span class="min-w-0 truncate text-sm text-ink">
                                {{ itemName(item.name, item.app_product) }}
                                <span
                                    v-if="item.options"
                                    class="text-ink-muted"
                                >
                                    ({{ optionsLabel(item.options) }})</span
                                >
                                <span class="text-ink-muted">
                                    ·
                                    {{
                                        item.photo_count === 1
                                            ? t('1 photo')
                                            : t(':count photos', {
                                                  count: item.photo_count,
                                              })
                                    }}</span
                                >
                            </span>
                            <span
                                class="shrink-0 text-sm font-semibold text-ink"
                            >
                                {{ formatPrice(item.amount_minor) }}
                            </span>
                        </li>
                    </ul>

                    <div
                        class="mt-3 flex items-baseline justify-between gap-2 border-t border-sand-100 pt-2"
                    >
                        <p class="text-sm font-bold text-ink">
                            {{ t('Total') }}
                        </p>
                        <p class="font-bold text-ink">
                            {{ formatPrice(order.amount_minor) }}
                        </p>
                    </div>

                    <p
                        v-if="order.printdeal_order_number"
                        class="mt-1 text-xs text-ink-muted"
                    >
                        {{
                            t('Printer reference: :number', {
                                number: order.printdeal_order_number,
                            })
                        }}
                    </p>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
