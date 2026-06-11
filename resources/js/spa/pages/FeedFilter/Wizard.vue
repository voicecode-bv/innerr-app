<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CirclePicker from '@/components/CirclePicker.vue';
import PersonPicker from '@/components/PersonPicker.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useCirclesStore } from '@/spa/stores/circles';
import type { Circle } from '@/spa/stores/circles';
import { useFeedFilterStore } from '@/spa/stores/feedFilter';
import { usePersonsStore } from '@/spa/stores/persons';
import type { Person } from '@/spa/stores/persons';
import calendarIcon from '../../../../svg/doodle-icons/calendar.svg';

const TOTAL_STEPS = 3;

const router = useRouter();
const { t } = useTranslations();
const personsStore = usePersonsStore();
const circlesStore = useCirclesStore();
const filter = useFeedFilterStore();

const step = ref(1);
// Bepaalt de richting van de slide-animatie: vooruit schuift de nieuwe stap
// van rechts in, terug van links.
const direction = ref<'forward' | 'back'>('forward');

const persons = ref<Person[]>([]);
const allCircles = ref<Circle[]>([]);

// Begint op false zodat de balken op 0% renderen; na mount springt dit op true
// en animeert ook de eerste stap zijn fill (een transition vanaf de
// initiële render zelf vuurt niet).
const indicatorReady = ref(false);

const todayIso = new Date().toISOString().slice(0, 10);

onMounted(() => {
    requestAnimationFrame(() => {
        indicatorReady.value = true;
    });
});

onMounted(async () => {
    try {
        const [loadedPersons, loadedCircles] = await Promise.all([
            personsStore.ensureLoaded(),
            circlesStore.ensureLoaded(),
        ]);
        persons.value = loadedPersons;
        allCircles.value = loadedCircles;
    } catch {
        persons.value = [];
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

const title = computed<string>(() => {
    switch (step.value) {
        case 1:
            return t('Whose moments?');
        case 2:
            return t('Which circles?');
        default:
            return t('Which period?');
    }
});

const subtitle = computed<string>(() => {
    switch (step.value) {
        case 1:
            return t(
                'Pick the people you want to see. Leave empty to include everyone.',
            );
        case 2:
            return allowedCircleIds.value === null
                ? t(
                      'Pick the circles to look in. Leave empty to search all of them.',
                  )
                : t('Only circles the selected people are in.');
        default:
            return t(
                'Filter by when the photo was taken. Leave empty for any date.',
            );
    }
});

const primaryLabel = computed<string>(() =>
    step.value === TOTAL_STEPS ? t('Show results') : t('Continue'),
);

const transitionName = computed<string>(() =>
    direction.value === 'forward' ? 'slide-forward' : 'slide-back',
);

function goNext(): void {
    if (step.value < TOTAL_STEPS) {
        direction.value = 'forward';
        step.value += 1;

        return;
    }

    router.push({ name: 'spa.feed-filter.results' });
}

function goBack(): void {
    if (step.value > 1) {
        direction.value = 'back';
        step.value -= 1;

        return;
    }

    router.push({ name: 'spa.home' });
}

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
        <div class="px-6 pt-6">
            <button
                type="button"
                class="hit-slop relative mb-4 -ml-2 flex size-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand-100"
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
            <div class="flex items-center gap-2">
                <div
                    v-for="n in TOTAL_STEPS"
                    :key="n"
                    class="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-200"
                >
                    <div
                        class="h-full rounded-full bg-action transition-[width] duration-300 ease-out"
                        :style="{
                            width: indicatorReady && n <= step ? '100%' : '0%',
                        }"
                    />
                </div>
            </div>
            <p class="mt-3 text-sm text-ink-muted">
                {{
                    t('Step :current of :total', {
                        current: String(step),
                        total: String(TOTAL_STEPS),
                    })
                }}
            </p>
        </div>

        <div
            class="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-6 pt-4 pb-[calc(7rem+var(--inset-bottom,0px))]"
        >
            <Transition :name="transitionName" mode="out-in">
                <div :key="step" class="flex flex-1 flex-col">
                    <div class="mb-6">
                        <h1
                            class="text-3xl font-extrabold tracking-tight text-ink"
                        >
                            {{ title }}
                        </h1>
                        <p v-if="subtitle" class="mt-2 text-ink-muted">
                            {{ subtitle }}
                        </p>
                    </div>

                    <PersonPicker
                        v-if="step === 1"
                        :persons="persons"
                        :selected-ids="filter.selectedPersonIds"
                        layout="grid"
                        :title="t('People')"
                        searchable
                        :collapsible="false"
                        @update:selected-ids="filter.selectedPersonIds = $event"
                    />

                    <template v-else-if="step === 2">
                        <p
                            v-if="
                                allowedCircleIds !== null &&
                                visibleCircles.length === 0
                            "
                            class="text-ink-muted"
                        >
                            {{
                                t(
                                    'The selected people are not in any circles you can filter.',
                                )
                            }}
                        </p>
                        <CirclePicker
                            v-else
                            :circles="visibleCircles"
                            :selected-ids="filter.selectedCircleIds"
                            layout="grid"
                            :title="t('Circles')"
                            :collapsible="false"
                            @update:selected-ids="
                                filter.selectedCircleIds = $event
                            "
                        />
                    </template>

                    <div v-else class="space-y-4">
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
                </div>
            </Transition>
        </div>

        <div
            class="fixed right-[var(--inset-right,0)] bottom-0 left-[var(--inset-left,0)] z-50 flex items-center gap-3 border-t border-dark-sand bg-sand px-6 pt-3 pb-[calc(0.75rem+var(--inset-bottom,0px))]"
        >
            <button
                type="button"
                class="flex-1 rounded-lg bg-sand-100 py-3.5 font-semibold text-ink transition-colors hover:bg-sand-200"
                @click="goBack"
            >
                {{ t('Back') }}
            </button>
            <button
                type="button"
                class="flex-1 rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:opacity-40"
                @click="goNext"
            >
                {{ primaryLabel }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
    transition:
        opacity 0.25s ease,
        transform 0.25s ease;
}

.slide-forward-enter-from {
    opacity: 0;
    transform: translateX(2rem);
}

.slide-forward-leave-to {
    opacity: 0;
    transform: translateX(-2rem);
}

.slide-back-enter-from {
    opacity: 0;
    transform: translateX(-2rem);
}

.slide-back-leave-to {
    opacity: 0;
    transform: translateX(2rem);
}
</style>
