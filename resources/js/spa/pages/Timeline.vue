<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { PostData } from '@/spa/components/PostCard.vue';
import PostMasonry from '@/spa/components/PostMasonry.vue';
import { useInfiniteScroll } from '@/spa/composables/useInfiniteScroll';
import type { PaginatedResponse } from '@/spa/composables/useInfiniteScroll';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import type { Person } from '@/spa/stores/persons';
import { usePersonsStore } from '@/spa/stores/persons';

const route = useRoute();
const router = useRouter();
const { t } = useTranslations();
const personsStore = usePersonsStore();

// Eén of meerdere kinderen, komma-gescheiden in de route-param. Zo werkt zowel
// de losse chip-ingang (één id) als de multi-select uit de feed-dropdown.
const personIds = String(route.params.person).split(',').filter(Boolean);
const sentinelRef = ref<HTMLElement | null>(null);

// De personenlijst wordt voor de naam/koptekst gebruikt. Lukt het laden niet,
// dan tonen we de tijdlijn alsnog met een neutrale titel.
const persons = ref<Person[]>(
    (personsStore.items ?? []).filter((p) => personIds.includes(p.id)),
);

void personsStore.ensureLoaded().then((items) => {
    const matched = items.filter((p) => personIds.includes(p.id));

    if (matched.length > 0) {
        persons.value = matched;
    }
});

const title = computed(() => {
    if (personIds.length === 1) {
        return persons.value[0]?.name ?? t('Timeline');
    }

    return t(':count children', { count: personIds.length });
});

/**
 * Bouwt de feed-query voor deze tijdlijn: gefilterd op de gekozen kinderen en
 * chronologisch gesorteerd op de opname-datum (`taken_at`) in plaats van de
 * upload-datum. De API valt voor posts zonder EXIF-datum terug op `created_at`.
 */
function buildQuery(page: number): string {
    const params = new URLSearchParams();
    params.set('page', String(page));

    for (const id of personIds) {
        params.append('person_ids[]', id);
    }

    params.set('sort', 'taken_at');
    params.set('order', 'asc');

    return params.toString();
}

const feed = useInfiniteScroll<PostData>(
    (page) =>
        externalApi.get<PaginatedResponse<PostData>>(
            `/feed?${buildQuery(page)}`,
        ),
    sentinelRef,
);

function goBack(): void {
    router.back();
}
</script>

<template>
    <AppLayout :title="title">
        <template #header-left>
            <button
                class="flex items-center text-ink"
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
        </template>

        <div
            class="mt-10 pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))]"
        >
            <div
                class="flex items-center gap-2 border-b border-dark-sand bg-sand px-4 py-3"
            >
                <span class="text-sm font-medium text-ink">
                    {{ t('Timeline') }}
                </span>
                <span class="text-sm text-ink-muted">
                    {{ t('Sorted by when each moment was captured.') }}
                </span>
            </div>

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
                    {{ t('No moments yet') }}
                </h3>
                <p class="mt-2 text-ink-muted">
                    {{ t('Photos you share of this person will appear here.') }}
                </p>
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
