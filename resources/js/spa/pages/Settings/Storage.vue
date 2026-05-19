<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useI18nStore } from '@/spa/stores/i18n';

interface StorageUsage {
    used_bytes: number;
    limit_bytes: number | null;
    plan: { slug: string; name: string };
}

const FAMILY_PLAN_SLUG = 'pro';

const { t } = useTranslations();
const i18n = useI18nStore();
const router = useRouter();
const { isIos, isAndroid } = usePlatform();

const usage = ref<StorageUsage | null>(null);
const loaded = ref(false);
const errorMessage = ref<string | null>(null);

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

const usagePercent = computed(() => {
    const data = usage.value;

    if (!data || !data.limit_bytes) {
        return 0;
    }

    const ratio = data.used_bytes / data.limit_bytes;

    return Math.min(100, Math.max(0, Math.round(ratio * 100)));
});

const isFamilyPlan = computed(
    () => usage.value?.plan?.slug === FAMILY_PLAN_SLUG,
);

const showUpgradeCta = computed(
    () =>
        usage.value !== null &&
        !isFamilyPlan.value &&
        (isIos.value || isAndroid.value),
);

const barToneClass = computed(() => {
    if (usagePercent.value >= 90) {
        return 'bg-blush-500';
    }

    if (usagePercent.value >= 75) {
        return 'bg-brand-orange';
    }

    return 'bg-brand-yellow';
});

function formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined) {
        return t('Unlimited');
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const formatter = new Intl.NumberFormat(
        i18n.locale === 'nl' ? 'nl-NL' : 'en-US',
        { maximumFractionDigits: unitIndex >= 3 ? 2 : 1 },
    );

    return `${formatter.format(value)} ${units[unitIndex]}`;
}

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

function goToSubscriptions(): void {
    router.push({ name: 'spa.settings.subscriptions' });
}

async function load(): Promise<void> {
    errorMessage.value = null;

    try {
        usage.value = await externalApi.get<StorageUsage>('/account/storage');
    } catch (error) {
        errorMessage.value =
            (error as Error).message ?? t('Could not load storage usage.');
    } finally {
        loaded.value = true;
    }
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: load,
    containerRef,
});

onMounted(load);
</script>

<template>
    <AppLayout ref="layout" :title="t('Storage')">
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
            class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <SurfaceCard v-if="!loaded" class="reveal-item">
                    <div class="animate-pulse">
                        <div class="flex items-center gap-3">
                            <div class="size-9 rounded-lg bg-sand-200" />
                            <div class="h-3 w-40 rounded bg-sand-200" />
                        </div>
                        <div class="mt-4 h-3 w-full rounded-full bg-sand-200" />
                        <div class="mt-3 h-3 w-1/3 rounded bg-sand-200" />
                    </div>
                </SurfaceCard>

                <div
                    v-else-if="usage"
                    class="reveal-item rounded-lg bg-action p-5 shadow-sm shadow-action/20"
                >
                    <h3
                        class="font-display text-lg font-semibold text-brand-sand"
                    >
                        {{ t('Storage usage') }}
                    </h3>

                    <p class="mt-2 text-brand-sand/80">
                        {{
                            t(
                                'This is the total space used by the photos and videos you have uploaded to your circles. Items shared with you by others do not count towards your limit.',
                            )
                        }}
                    </p>

                    <div class="mt-4">
                        <div class="flex items-baseline justify-between gap-2">
                            <span
                                class="font-display text-xl font-semibold text-brand-yellow"
                            >
                                {{ formatBytes(usage.used_bytes) }}
                            </span>
                            <span class="text-brand-sand/80">
                                {{
                                    t('of :total used', {
                                        total: formatBytes(usage.limit_bytes),
                                    })
                                }}
                            </span>
                        </div>

                        <div
                            class="mt-3 h-3 overflow-hidden rounded-full bg-brand-sand/20"
                            role="progressbar"
                            :aria-valuenow="usagePercent"
                            aria-valuemin="0"
                            aria-valuemax="100"
                        >
                            <div
                                class="h-full rounded-full transition-all duration-500"
                                :class="barToneClass"
                                :style="{ width: `${usagePercent}%` }"
                            />
                        </div>

                        <p
                            v-if="usage.limit_bytes"
                            class="mt-2 text-brand-sand/80"
                        >
                            {{ t(':percent% used', { percent: usagePercent }) }}
                        </p>
                    </div>
                </div>

                <div
                    v-if="showUpgradeCta"
                    class="reveal-item rounded-lg bg-brand-green p-5 shadow-sm shadow-sage-900/20"
                >
                    <h3
                        class="font-display text-lg font-semibold text-brand-sand"
                    >
                        {{ t('Need more space?') }}
                    </h3>
                    <p class="mt-1 text-brand-sand/90">
                        {{
                            t(
                                'Upgrade to Familie+ for 1 TB of storage for your photos and videos.',
                            )
                        }}
                    </p>
                    <Button
                        variant="inverse"
                        size="lg"
                        block
                        class="mt-4"
                        @click="goToSubscriptions"
                    >
                        {{ t('View subscriptions') }}
                    </Button>
                </div>

                <p
                    v-if="errorMessage"
                    class="rounded-lg bg-destructive-soft p-3 text-destructive-ink"
                >
                    {{ errorMessage }}
                </p>
            </div>
        </div>
    </AppLayout>
</template>
