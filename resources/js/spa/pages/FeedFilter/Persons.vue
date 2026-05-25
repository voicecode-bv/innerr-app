<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PersonPicker from '@/components/PersonPicker.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useFeedFilterStore } from '@/spa/stores/feedFilter';
import { usePersonsStore } from '@/spa/stores/persons';
import type { Person } from '@/spa/stores/persons';
import FilterStepLayout from './FilterStepLayout.vue';

const router = useRouter();
const { t } = useTranslations();
const personsStore = usePersonsStore();
const filter = useFeedFilterStore();

const persons = ref<Person[]>([]);

onMounted(async () => {
    try {
        persons.value = await personsStore.ensureLoaded();
    } catch {
        persons.value = [];
    }
});
</script>

<template>
    <FilterStepLayout
        :step="1"
        :total-steps="3"
        :title="t('Whose moments?')"
        :subtitle="
            t(
                'Pick the people you want to see. Leave empty to include everyone.',
            )
        "
        :primary-label="t('Continue')"
        @next="router.push({ name: 'spa.feed-filter.circles' })"
        @back="router.push({ name: 'spa.home' })"
    >
        <PersonPicker
            :persons="persons"
            :selected-ids="filter.selectedPersonIds"
            layout="grid"
            :title="t('People')"
            searchable
            :collapsible="false"
            @update:selected-ids="filter.selectedPersonIds = $event"
        />
    </FilterStepLayout>
</template>
