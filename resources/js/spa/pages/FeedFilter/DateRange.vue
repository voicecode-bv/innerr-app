<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useFeedFilterStore } from '@/spa/stores/feedFilter';
import calendarIcon from '../../../../svg/doodle-icons/calendar.svg';
import FilterStepLayout from './FilterStepLayout.vue';

const router = useRouter();
const { t } = useTranslations();
const filter = useFeedFilterStore();

const todayIso = new Date().toISOString().slice(0, 10);

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
    <FilterStepLayout
        :step="3"
        :total-steps="3"
        :title="t('Which period?')"
        :subtitle="
            t('Filter by when the photo was taken. Leave empty for any date.')
        "
        :primary-label="t('Show results')"
        @next="router.push({ name: 'spa.feed-filter.results' })"
        @back="router.push({ name: 'spa.feed-filter.circles' })"
    >
        <div class="space-y-4">
            <div
                class="flex items-center gap-4 rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
            >
                <div
                    class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-yellow text-brand-blue"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-7 bg-current"
                        :style="iconMaskStyle(calendarIcon)"
                    ></span>
                </div>
                <div class="flex-1">
                    <label
                        for="filter-date-from"
                        class="tracking-wider text-ink-muted uppercase"
                    >
                        {{ t('From') }}
                    </label>
                    <input
                        id="filter-date-from"
                        v-model="filter.dateFrom"
                        type="date"
                        :max="filter.dateTo ?? todayIso"
                        class="mt-1 w-full border-0 bg-transparent p-0 font-sans text-xl font-semibold text-ink focus:ring-0 focus:outline-none"
                    />
                </div>
            </div>

            <div
                class="flex items-center gap-4 rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
            >
                <div
                    class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-yellow text-brand-blue"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-7 bg-current"
                        :style="iconMaskStyle(calendarIcon)"
                    ></span>
                </div>
                <div class="flex-1">
                    <label
                        for="filter-date-to"
                        class="tracking-wider text-ink-muted uppercase"
                    >
                        {{ t('Until') }}
                    </label>
                    <input
                        id="filter-date-to"
                        v-model="filter.dateTo"
                        type="date"
                        :min="filter.dateFrom ?? undefined"
                        :max="todayIso"
                        class="mt-1 w-full border-0 bg-transparent p-0 font-sans text-xl font-semibold text-ink focus:ring-0 focus:outline-none"
                    />
                </div>
            </div>
        </div>
    </FilterStepLayout>
</template>
