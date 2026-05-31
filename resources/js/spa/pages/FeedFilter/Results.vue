<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { PostData } from '@/spa/components/PostCard.vue';
import PostMasonry from '@/spa/components/PostMasonry.vue';
import { useInfiniteScroll } from '@/spa/composables/useInfiniteScroll';
import type { PaginatedResponse } from '@/spa/composables/useInfiniteScroll';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useFeedFilterStore } from '@/spa/stores/feedFilter';

const router = useRouter();
const { t, locale } = useTranslations();
const filter = useFeedFilterStore();

const sentinelRef = ref<HTMLElement | null>(null);

const feed = useInfiniteScroll<PostData>(
    (page) =>
        externalApi.get<PaginatedResponse<PostData>>(
            `/feed?${filter.buildQuery(page)}`,
        ),
    sentinelRef,
);

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(locale.value, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

const summaryChips = computed<string[]>(() => {
    const chips: string[] = [];

    if (filter.selectedPersonIds.length > 0) {
        const count = filter.selectedPersonIds.length;
        chips.push(
            count === 1
                ? t('1 person')
                : t(':count people', { count: String(count) }),
        );
    }

    if (filter.selectedCircleIds.length > 0) {
        const count = filter.selectedCircleIds.length;
        chips.push(
            count === 1
                ? t('1 circle')
                : t(':count circles', { count: String(count) }),
        );
    }

    if (filter.dateFrom && filter.dateTo) {
        chips.push(
            t(':from to :to', {
                from: formatDate(filter.dateFrom),
                to: formatDate(filter.dateTo),
            }),
        );
    } else if (filter.dateFrom) {
        chips.push(t('From :date', { date: formatDate(filter.dateFrom) }));
    } else if (filter.dateTo) {
        chips.push(t('Until :date', { date: formatDate(filter.dateTo) }));
    }

    return chips;
});

function editFilters(): void {
    router.push({ name: 'spa.feed-filter' });
}
</script>

<template>
    <AppLayout :title="t('Results')">
        <template #header-left>
            <button
                class="flex items-center text-ink"
                :aria-label="t('Edit filters')"
                @click="editFilters"
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
        </template>

        <div class="mt-10 pb-24">
            <button
                type="button"
                class="flex w-full flex-wrap items-center gap-2 border-b border-dark-sand bg-sand px-4 py-3 text-left"
                @click="editFilters"
            >
                <template v-if="summaryChips.length > 0">
                    <span
                        v-for="chip in summaryChips"
                        :key="chip"
                        class="rounded-full bg-surface px-3 py-1 text-sm font-medium text-ink shadow-sm"
                    >
                        {{ chip }}
                    </span>
                </template>
                <span v-else class="text-sm text-ink-muted">
                    {{ t('All moments. Tap to filter.') }}
                </span>
            </button>

            <PostMasonry
                v-if="feed.items.length > 0 || feed.loading"
                class="mt-2"
                :posts="feed.items"
                :loading="feed.loading"
            />

            <div
                v-else
                class="flex min-h-[50vh] flex-col items-center justify-center px-8 text-center"
            >
                <h3 class="font-display text-xl font-semibold text-ink">
                    {{ t('No moments match these filters.') }}
                </h3>
                <p class="mt-2 text-ink-muted">
                    {{ t('Try widening your selection or date range.') }}
                </p>
                <button
                    type="button"
                    class="mt-5 rounded-lg bg-action px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover"
                    @click="editFilters"
                >
                    {{ t('Edit filters') }}
                </button>
            </div>

            <div
                v-if="feed.loading && feed.items.length > 0"
                class="flex items-center justify-center gap-2 py-6 text-ink-muted"
            >
                {{ t('Loading more...') }}
            </div>

            <div ref="sentinelRef" class="h-1" />
        </div>
    </AppLayout>
</template>
