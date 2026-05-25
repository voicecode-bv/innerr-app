<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CirclePicker from '@/components/CirclePicker.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useCirclesStore } from '@/spa/stores/circles';
import type { Circle } from '@/spa/stores/circles';
import { useFeedFilterStore } from '@/spa/stores/feedFilter';
import { usePersonsStore } from '@/spa/stores/persons';
import FilterStepLayout from './FilterStepLayout.vue';

const router = useRouter();
const { t } = useTranslations();
const circlesStore = useCirclesStore();
const personsStore = usePersonsStore();
const filter = useFeedFilterStore();

const allCircles = ref<Circle[]>([]);

onMounted(async () => {
    try {
        const [circles] = await Promise.all([
            circlesStore.ensureLoaded(),
            personsStore.ensureLoaded().catch(() => []),
        ]);
        allCircles.value = circles;
    } catch {
        allCircles.value = [];
    }
});

// Circle-ids waarin de in stap 1 gekozen personen daadwerkelijk zitten.
// null = geen personen gekozen, dus geen beperking op de kringen.
const allowedCircleIds = computed<Set<string> | null>(() => {
    if (filter.selectedPersonIds.length === 0) {
        return null;
    }

    const selected = new Set(filter.selectedPersonIds);
    const ids = new Set<string>();

    for (const person of personsStore.items ?? []) {
        if (selected.has(person.id)) {
            for (const circleId of person.circle_ids ?? []) {
                ids.add(circleId);
            }
        }
    }

    return ids;
});

const visibleCircles = computed<Circle[]>(() => {
    const allowed = allowedCircleIds.value;

    if (allowed === null) {
        return allCircles.value;
    }

    return allCircles.value.filter((circle) => allowed.has(circle.id));
});

const subtitle = computed(() =>
    allowedCircleIds.value === null
        ? t('Pick the circles to look in. Leave empty to search all of them.')
        : t('Only circles the selected people are in.'),
);

// Deselecteer kringen die door de personen-filter zijn weggevallen, zodat we
// niet op een kring filteren die niet meer in de lijst staat.
watch(visibleCircles, (circles) => {
    if (filter.selectedCircleIds.length === 0) {
        return;
    }

    const visibleIds = new Set(circles.map((circle) => circle.id));
    const pruned = filter.selectedCircleIds.filter((id) => visibleIds.has(id));

    if (pruned.length !== filter.selectedCircleIds.length) {
        filter.selectedCircleIds = pruned;
    }
});
</script>

<template>
    <FilterStepLayout
        :step="2"
        :total-steps="3"
        :title="t('Which circles?')"
        :subtitle="subtitle"
        :primary-label="t('Continue')"
        @next="router.push({ name: 'spa.feed-filter.dates' })"
        @back="router.push({ name: 'spa.feed-filter.persons' })"
    >
        <p
            v-if="allowedCircleIds !== null && visibleCircles.length === 0"
            class="text-ink-muted"
        >
            {{
                t('The selected people are not in any circles you can filter.')
            }}
        </p>
        <CirclePicker
            v-else
            :circles="visibleCircles"
            :selected-ids="filter.selectedCircleIds"
            layout="grid"
            :title="t('Circles')"
            :collapsible="false"
            @update:selected-ids="filter.selectedCircleIds = $event"
        />
    </FilterStepLayout>
</template>
