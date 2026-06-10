<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import CircleListItem from '@/spa/components/CircleListItem.vue';
import { useApiForm } from '@/spa/composables/useApiForm';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useCirclesStore } from '@/spa/stores/circles';
import usersIcon from '../../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const router = useRouter();
const circlesStore = useCirclesStore();

const circles = computed(() => circlesStore.items);

function goBack(): void {
    if (window.history.length > 1) {
        router.back();
    } else {
        router.push({ name: 'spa.home' });
    }
}

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

async function loadCircles(force = false): Promise<void> {
    try {
        if (force) {
            circlesStore.invalidate();
        }

        await circlesStore.ensureLoaded();
    } catch {
        // negeren
    }
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: () => loadCircles(true),
    containerRef,
});

onMounted(() => loadCircles());

const showCreateForm = ref(false);
const form = useApiForm({ name: '' }, externalApi);

async function createCircle(): Promise<void> {
    await form.post('/circles', {
        onSuccess: () => {
            form.reset();
            showCreateForm.value = false;
            circlesStore.invalidate();
            void loadCircles();
        },
    });
}
</script>

<template>
    <AppLayout ref="layout" :title="t('Circles')">
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
        <template #header-right>
            <button
                class="flex size-9 items-center justify-center rounded-full bg-action text-white shadow-sm transition hover:bg-action-hover"
                :aria-label="t('Create circle')"
                data-tour="circles.create"
                @click="showCreateForm = !showCreateForm"
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
                        v-if="!showCreateForm"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                    />
                    <path
                        v-else
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </template>

        <div
            class="relative mt-10 pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div class="relative space-y-4 px-4 pt-4">
                <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="-translate-y-2 opacity-0"
                    enter-to-class="translate-y-0 opacity-100"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="translate-y-0 opacity-100"
                    leave-to-class="-translate-y-2 opacity-0"
                >
                    <SurfaceCard v-if="showCreateForm">
                        <form class="space-y-3" @submit.prevent="createCircle">
                            <label class="font-semibold text-ink">
                                {{ t('New circle') }}
                            </label>
                            <input
                                v-model="form.data.name"
                                type="text"
                                :placeholder="t('Circle name...')"
                                class="mt-2 field"
                                autofocus
                            />
                            <p v-if="form.errors.name" class="text-accent">
                                {{ form.errors.name }}
                            </p>
                            <div class="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="md"
                                    @click="
                                        showCreateForm = false;
                                        form.reset();
                                    "
                                >
                                    {{ t('Cancel') }}
                                </Button>
                                <Button
                                    type="submit"
                                    size="md"
                                    :disabled="
                                        form.processing ||
                                        !form.data.name.trim()
                                    "
                                >
                                    {{ t('Create') }}
                                </Button>
                            </div>
                        </form>
                    </SurfaceCard>
                </Transition>

                <ul
                    v-if="circles === null"
                    class="divide-y divide-sand-100 overflow-hidden rounded-lg bg-surface/70 backdrop-blur-sm"
                >
                    <li
                        v-for="n in 3"
                        :key="n"
                        class="flex items-center gap-4 px-4 py-4"
                    >
                        <div class="size-12 shrink-0 shimmer rounded-full" />
                        <div class="flex-1 space-y-2">
                            <div class="h-4 w-32 shimmer rounded" />
                            <div class="h-3 w-20 shimmer rounded" />
                        </div>
                    </li>
                </ul>

                <ul
                    v-else-if="circles.length > 0"
                    data-tour="circles.list"
                    class="divide-y divide-sand-100 overflow-hidden rounded-lg"
                >
                    <li v-for="circle in circles" :key="circle.id">
                        <CircleListItem
                            :circle="circle"
                            avatar-shape="circle"
                        />
                    </li>
                </ul>

                <SurfaceCard v-else-if="circles.length === 0">
                    <div
                        class="flex flex-col items-center px-2 py-4 text-center"
                    >
                        <IconTile
                            :icon="usersIcon"
                            size="lg"
                            tone="sage"
                            class="mb-4"
                        />
                        <h3 class="font-sans text-lg font-semibold text-ink">
                            {{ t('No circles yet') }}
                        </h3>
                        <p class="mt-1 text-sand-600">
                            {{
                                t(
                                    'Create a circle to share moments with specific people.',
                                )
                            }}
                        </p>
                        <div class="mt-5">
                            <Button size="md" @click="showCreateForm = true">
                                {{ t('Create your first circle') }}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        </div>
    </AppLayout>
</template>
