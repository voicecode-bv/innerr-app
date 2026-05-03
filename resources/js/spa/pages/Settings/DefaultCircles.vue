<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import IconTile from '@/components/IconTile.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useCirclesStore } from '@/spa/stores/circles';
import { useDefaultCirclesStore } from '@/spa/stores/defaultCircles';
import usersIcon from '../../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const router = useRouter();
const circlesStore = useCirclesStore();
const defaultCirclesStore = useDefaultCirclesStore();

const circles = computed(() => circlesStore.items ?? []);
const selectedIds = computed(() => defaultCirclesStore.ids ?? []);
const loaded = ref(false);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

async function loadDefaults(force = false): Promise<void> {
    try {
        if (force) {
            circlesStore.invalidate();
            defaultCirclesStore.invalidate();
        }
        await Promise.all([
            circlesStore.ensureLoaded(),
            defaultCirclesStore.ensureLoaded(),
        ]);
    } catch {
        // ignore
    } finally {
        loaded.value = true;
    }
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: () => loadDefaults(true),
    containerRef,
});

onMounted(() => loadDefaults());

async function toggleCircle(circleId: number): Promise<void> {
    // Intersect met de zichtbare kringen zodat eventuele stale IDs (kring
    // verwijderd of lidmaatschap opgezegd) niet meer in de payload komen —
    // de externe API valideert dat ieder ID nog geldig is.
    const validIds = new Set(circles.value.map((c) => c.id));
    const current = (defaultCirclesStore.ids ?? []).filter((id) =>
        validIds.has(id),
    );
    const next = current.includes(circleId)
        ? current.filter((id) => id !== circleId)
        : [...current, circleId];

    try {
        await defaultCirclesStore.setIds(next);
    } catch {
        // Stille rollback in de store; geen toast — net als bij
        // NotificationPreferences blijft de toggle UI de waarheid tonen.
    }
}
</script>

<template>
    <AppLayout ref="layout" :title="t('Default circles')">
        <template #header-left>
            <button
                class="flex items-center text-teal dark:text-sand-300"
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
            class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <SurfaceCard
                    v-if="!loaded && circles.length === 0"
                    class="reveal-item"
                >
                    <div class="animate-pulse">
                        <div class="flex items-center gap-3">
                            <div
                                class="size-9 rounded-lg bg-sand-200 dark:bg-sand-700"
                            />
                            <div
                                class="h-3 w-40 rounded bg-sand-200 dark:bg-sand-700"
                            />
                        </div>
                        <div
                            class="mt-3 h-2 w-2/3 rounded bg-sand-200 dark:bg-sand-700"
                        />
                        <ul
                            class="mt-3 divide-y divide-sand-100 dark:divide-sand-700/60"
                        >
                            <li
                                v-for="n in 4"
                                :key="n"
                                class="flex items-center justify-between gap-3 py-3"
                            >
                                <span
                                    class="h-3 w-32 rounded bg-sand-200 dark:bg-sand-700"
                                />
                                <span
                                    class="h-8 w-14 shrink-0 rounded-full bg-sand-200 dark:bg-sand-700/60"
                                />
                            </li>
                        </ul>
                    </div>
                </SurfaceCard>

                <SurfaceCard v-else-if="circles.length > 0" class="reveal-item">
                    <h3
                        class="flex items-center gap-3 font-semibold text-sand-900 dark:text-sand-100"
                    >
                        <IconTile :icon="usersIcon" size="sm" tone="sage" />
                        {{ t('Default circles for new posts') }}
                    </h3>
                    <p class="mt-1 text-sand-600 dark:text-sand-400">
                        {{
                            t(
                                'These circles will be pre-selected when you create a new post.',
                            )
                        }}
                    </p>

                    <ul
                        v-if="!loaded"
                        class="mt-3 divide-y divide-sand-100 dark:divide-sand-700/60"
                    >
                        <li
                            v-for="circle in circles"
                            :key="circle.id"
                            class="flex items-center justify-between gap-3 py-3"
                        >
                            <span
                                class="text-base text-sand-800 dark:text-sand-100"
                                >{{ circle.name }}</span
                            >
                            <span
                                class="h-8 w-14 shrink-0 animate-pulse rounded-full bg-sand-200 dark:bg-sand-700/60"
                            />
                        </li>
                    </ul>

                    <ul
                        v-else
                        class="mt-3 divide-y divide-sand-100 dark:divide-sand-700/60"
                    >
                        <li
                            v-for="circle in circles"
                            :key="circle.id"
                            class="reveal-item"
                        >
                            <label
                                class="flex cursor-pointer items-center justify-between gap-3 py-3"
                            >
                                <span
                                    class="text-base text-sand-800 dark:text-sand-100"
                                    >{{ circle.name }}</span
                                >
                                <button
                                    type="button"
                                    role="switch"
                                    :aria-checked="
                                        selectedIds.includes(circle.id)
                                    "
                                    :class="
                                        selectedIds.includes(circle.id)
                                            ? 'bg-teal'
                                            : 'bg-sand-300 dark:bg-sand-600'
                                    "
                                    class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                                    @click="toggleCircle(circle.id)"
                                >
                                    <span
                                        :class="
                                            selectedIds.includes(circle.id)
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                        "
                                        class="pointer-events-none mt-1 size-6 rounded-full bg-white shadow transition-transform"
                                    />
                                </button>
                            </label>
                        </li>
                    </ul>
                </SurfaceCard>

                <SurfaceCard v-else-if="loaded" class="reveal-item">
                    <div
                        class="flex flex-col items-center px-2 py-4 text-center"
                    >
                        <IconTile
                            :icon="usersIcon"
                            size="lg"
                            tone="sage"
                            class="mb-4"
                        />
                        <h3
                            class="font-sans text-lg font-semibold text-teal dark:text-sand-100"
                        >
                            {{ t('No circles yet') }}
                        </h3>
                        <p class="mt-1 text-sand-600 dark:text-sand-400">
                            {{
                                t(
                                    'Create a circle to set it as a default for new posts.',
                                )
                            }}
                        </p>
                    </div>
                </SurfaceCard>
            </div>
        </div>
    </AppLayout>
</template>
