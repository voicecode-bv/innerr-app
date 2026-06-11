<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
import { usePersonsStore } from '@/spa/stores/persons';

/* Activation checklist for circle owners: the three actions that turn an
   empty album into a living one. Rows deep-link straight into the action,
   completed rows tick off, and the card retires itself (permanently, via
   localStorage) the moment all three are done. */
const DONE_STORAGE_KEY = 'spa.getting-started-card.done';
const DISMISSED_STORAGE_KEY = 'spa.getting-started-card.dismissed';

const { t } = useTranslations();
const auth = useAuthStore();
const circles = useCirclesStore();
const persons = usePersonsStore();

const ready = ref(false);
const ownPostsCount = ref<number | null>(null);
const dismissed = ref(readFlag(DISMISSED_STORAGE_KEY));
const retired = ref(readFlag(DONE_STORAGE_KEY));

function readFlag(key: string): boolean {
    try {
        return window.localStorage?.getItem(key) === '1';
    } catch {
        return false;
    }
}

function writeFlag(key: string): void {
    try {
        window.localStorage?.setItem(key, '1');
    } catch {
        // In-memory state still hides the card for this session.
    }
}

const ownedCircle = computed(() =>
    (circles.items ?? []).find((circle) => circle.is_owner),
);

const hasChild = computed(() => {
    const circleId = ownedCircle.value?.id;

    if (!circleId) {
        return false;
    }

    return (persons.items ?? []).some(
        (person) => !person.user_id && person.circle_ids?.includes(circleId),
    );
});

const hasInvited = computed(() => (ownedCircle.value?.members_count ?? 0) > 1);

const hasPosted = computed(() => (ownPostsCount.value ?? 0) > 0);

const steps = computed(() => [
    {
        label: 'Add your children',
        done: hasChild.value,
        to: { name: 'spa.settings.persons' },
    },
    {
        label: 'Invite your people',
        done: hasInvited.value,
        to: ownedCircle.value
            ? {
                  name: 'spa.circles.show',
                  params: { circle: ownedCircle.value.id },
              }
            : { name: 'spa.circles.index' },
    },
    {
        label: 'Share your first moment',
        done: hasPosted.value,
        to: { name: 'spa.posts.create' },
    },
]);

const doneCount = computed(
    () => steps.value.filter((step) => step.done).length,
);

const allDone = computed(() => doneCount.value === steps.value.length);

const visible = computed(
    () =>
        ready.value &&
        !dismissed.value &&
        !retired.value &&
        ownedCircle.value !== undefined &&
        !allDone.value,
);

function dismiss(): void {
    dismissed.value = true;
    writeFlag(DISMISSED_STORAGE_KEY);
}

onMounted(async () => {
    if (retired.value || dismissed.value) {
        return;
    }

    try {
        await Promise.all([circles.ensureLoaded(), persons.ensureLoaded()]);

        if (ownedCircle.value && auth.user?.username) {
            const profile = await externalApi.get<{
                data: { posts_count: number };
            }>(`/profiles/${encodeURIComponent(auth.user.username)}`);
            ownPostsCount.value = profile.data.posts_count;
        }
    } catch {
        // Missing data simply keeps the affected rows unchecked.
    } finally {
        ready.value = true;
    }

    if (allDone.value) {
        // Fully activated: never fetch for this card again on this device.
        writeFlag(DONE_STORAGE_KEY);
        retired.value = true;
    }
});
</script>

<template>
    <div
        v-if="visible"
        class="reveal-item relative overflow-hidden rounded-2xl bg-surface/80 p-5 shadow-sm ring-1 ring-sand-200/70 backdrop-blur-sm"
    >
        <div aria-hidden="true" class="pointer-events-none absolute inset-0">
            <div
                class="absolute -top-10 -right-8 size-32 rounded-full bg-sage-200/40 blur-2xl"
            ></div>
            <div class="absolute inset-0 grain opacity-[0.04]"></div>
        </div>

        <button
            type="button"
            class="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sand-100 hover:text-ink"
            :aria-label="t('Dismiss')"
            @click="dismiss"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="size-4"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                />
            </svg>
        </button>

        <div class="relative">
            <div class="flex items-baseline justify-between pr-8">
                <h3 class="text-lg font-bold tracking-tight text-ink">
                    {{ t('Getting started') }}
                </h3>
                <span class="text-xs font-semibold text-ink-muted">
                    {{ doneCount }}/{{ steps.length }}
                </span>
            </div>

            <ul class="mt-3 space-y-1">
                <li v-for="step in steps" :key="step.label">
                    <!-- Completed rows are inert; open rows deep-link into
                         the action itself. -->
                    <div
                        v-if="step.done"
                        class="flex items-center gap-3 rounded-xl px-2 py-2"
                    >
                        <span
                            class="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-green text-white"
                        >
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="size-3.5"
                            >
                                <path d="M5 12l5 5L20 7" />
                            </svg>
                        </span>
                        <span class="flex-1 text-sm font-medium text-ink-muted">
                            {{ t(step.label) }}
                        </span>
                    </div>
                    <RouterLink
                        v-else
                        :to="step.to"
                        class="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sand-50 active:bg-sand-50"
                    >
                        <span
                            class="size-6 shrink-0 rounded-full border-2 border-dashed border-sand-300"
                        ></span>
                        <span class="flex-1 text-sm font-semibold text-ink">
                            {{ t(step.label) }}
                        </span>
                        <svg
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="size-4 shrink-0 text-sand-300"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m8.25 4.5 7.5 7.5-7.5 7.5"
                            />
                        </svg>
                    </RouterLink>
                </li>
            </ul>
        </div>
    </div>
</template>
