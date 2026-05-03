<script setup lang="ts">
import { Dialog, Events, Off, On } from '@nativephp/mobile';
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import ListItem from '@/spa/components/ListItem.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTagsStore, type Tag } from '@/spa/stores/tags';
import { externalApi } from '@/spa/http/externalApi';
import tagIcon from '../../../../svg/doodle-icons/tag.svg';

const { t } = useTranslations();
const router = useRouter();
const tagsStore = useTagsStore();

const tags = computed<Tag[] | null>(() => tagsStore.items);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

async function loadTags(force = false): Promise<void> {
    try {
        if (force) tagsStore.invalidate();
        await tagsStore.ensureLoaded();
    } catch {
        // negeren
    }
}

async function refresh(): Promise<void> {
    // Sluit eventuele open edit/create-forms zodat de gebruiker een schone
    // lijst ziet na refresh.
    showCreateForm.value = false;
    editingTagId.value = null;
    createForm.reset();
    editForm.reset();
    await loadTags(true);
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: refresh,
    containerRef,
});

onMounted(loadTags);

const showCreateForm = ref(false);
const createForm = useApiForm({ name: '' }, externalApi);

async function createTag(): Promise<void> {
    const name = createForm.data.name.trim();
    if (!name || createForm.processing) return;

    const optimistic: Tag = { id: -Date.now(), name, usage_count: 0 };
    tagsStore.prepend(optimistic);
    showCreateForm.value = false;
    createForm.reset();

    try {
        const response = await externalApi.post<{ data: Tag }>('/tags', {
            name,
        });
        tagsStore.update(optimistic.id, response.data);
    } catch {
        tagsStore.remove(optimistic.id);
    }
}

const editingTagId = ref<number | null>(null);
const editForm = useApiForm({ name: '' }, externalApi);

function startEdit(tag: Tag): void {
    editingTagId.value = tag.id;
    editForm.data.name = tag.name.toLowerCase();
    editForm.errors = {};
}

function cancelEdit(): void {
    editingTagId.value = null;
    editForm.reset();
}

async function saveEdit(tag: Tag): Promise<void> {
    const newName = editForm.data.name.trim();
    if (!newName || editForm.processing) return;

    const previousName = tag.name;
    tagsStore.update(tag.id, { name: newName });
    editingTagId.value = null;
    editForm.reset();

    try {
        await externalApi.put(`/tags/${tag.id}`, { name: newName });
    } catch {
        tagsStore.update(tag.id, { name: previousName });
    }
}

let pendingDeleteTagId: number | null = null;

async function confirmDelete(tag: Tag): Promise<void> {
    pendingDeleteTagId = tag.id;

    const message =
        tag.usage_count > 0
            ? t(
                  '":name" is used on :count posts. Deleting it will remove the tag from those posts.',
                  {
                      name: tag.name,
                      count: tag.usage_count,
                  },
              )
            : t('Are you sure you want to delete ":name"?', { name: tag.name });

    await Dialog.alert()
        .confirm(t('Delete tag'), message)
        .id('delete-tag-confirm');
}

async function handleButtonPressed(payload: {
    index: number;
    id?: string | null;
}): Promise<void> {
    if (
        payload.id !== 'delete-tag-confirm' ||
        payload.index !== 1 ||
        pendingDeleteTagId === null
    ) {
        return;
    }

    const tagId = pendingDeleteTagId;
    pendingDeleteTagId = null;

    const previous = tagsStore.items?.find((tag) => tag.id === tagId);
    tagsStore.remove(tagId);
    if (editingTagId.value === tagId) {
        editingTagId.value = null;
        editForm.reset();
    }

    try {
        await externalApi.delete(`/tags/${tagId}`);
    } catch {
        if (previous) tagsStore.prepend(previous);
    }
}

onMounted(() => On(Events.Alert.ButtonPressed, handleButtonPressed));
onUnmounted(() => Off(Events.Alert.ButtonPressed, handleButtonPressed));

function lowercase(event: Event, target: { name: string }): void {
    target.name = (event.target as HTMLInputElement).value.toLowerCase();
}
</script>

<template>
    <AppLayout ref="layout" :title="t('Tags')">
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
        <template #header-right>
            <button
                class="flex size-9 items-center justify-center rounded-full bg-teal text-white shadow-sm transition hover:bg-teal-light"
                :aria-label="t('Add tag')"
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
            class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="-translate-y-2 opacity-0"
                    enter-to-class="translate-y-0 opacity-100"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="translate-y-0 opacity-100"
                    leave-to-class="-translate-y-2 opacity-0"
                >
                    <SurfaceCard v-if="showCreateForm" class="reveal-item">
                        <form class="space-y-3" @submit.prevent="createTag">
                            <label
                                class="tracking-wider text-sand-500 uppercase dark:text-sand-400"
                            >
                                {{ t('New tag') }}
                            </label>
                            <input
                                :value="createForm.data.name"
                                type="text"
                                :placeholder="t('Tag name...')"
                                class="field"
                                maxlength="50"
                                autofocus
                                @input="lowercase($event, createForm.data)"
                            />
                            <p
                                v-if="createForm.errors.name"
                                class="text-accent"
                            >
                                {{ createForm.errors.name }}
                            </p>
                            <div class="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="md"
                                    @click="
                                        showCreateForm = false;
                                        createForm.reset();
                                    "
                                >
                                    {{ t('Cancel') }}
                                </Button>
                                <Button
                                    type="submit"
                                    size="md"
                                    :disabled="
                                        createForm.processing ||
                                        !createForm.data.name.trim()
                                    "
                                >
                                    {{ t('Create') }}
                                </Button>
                            </div>
                        </form>
                    </SurfaceCard>
                </Transition>

                <ul
                    v-if="tags === null"
                    class="reveal-item divide-y divide-sand-100 overflow-hidden rounded-lg bg-white/70 backdrop-blur-sm dark:divide-sand-700/60 dark:bg-sand-800/60"
                >
                    <li
                        v-for="n in 4"
                        :key="n"
                        class="flex items-center gap-4 px-4 py-4"
                    >
                        <div
                            class="size-9 shrink-0 animate-pulse rounded-lg bg-sand-200 dark:bg-sand-700"
                        />
                        <div class="flex-1 space-y-2">
                            <div
                                class="h-4 w-24 animate-pulse rounded bg-sand-200 dark:bg-sand-700"
                            />
                            <div
                                class="h-3 w-16 animate-pulse rounded bg-sand-200/70 dark:bg-sand-700/70"
                            />
                        </div>
                    </li>
                </ul>

                <ul
                    v-else-if="tags.length > 0"
                    class="divide-y divide-sand-100 overflow-hidden rounded-lg dark:divide-sand-700/60"
                >
                    <li v-for="tag in tags" :key="tag.id" class="reveal-item">
                        <form
                            v-if="editingTagId === tag.id"
                            class="space-y-3 bg-white/70 px-4 py-4 backdrop-blur-sm dark:bg-sand-800/60"
                            @submit.prevent="saveEdit(tag)"
                        >
                            <input
                                :value="editForm.data.name"
                                type="text"
                                class="field"
                                maxlength="50"
                                autofocus
                                @input="lowercase($event, editForm.data)"
                            />
                            <p v-if="editForm.errors.name" class="text-accent">
                                {{ editForm.errors.name }}
                            </p>
                            <div
                                class="flex items-center justify-between gap-2"
                            >
                                <Button
                                    type="button"
                                    variant="danger"
                                    size="md"
                                    @click="confirmDelete(tag)"
                                >
                                    {{ t('Delete') }}
                                </Button>
                                <div class="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="md"
                                        @click="cancelEdit"
                                    >
                                        {{ t('Cancel') }}
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="md"
                                        :disabled="
                                            editForm.processing ||
                                            !editForm.data.name.trim()
                                        "
                                    >
                                        {{ t('Save') }}
                                    </Button>
                                </div>
                            </div>
                        </form>
                        <ListItem
                            v-else
                            :show-chevron="false"
                            @click="startEdit(tag)"
                        >
                            <template #leading
                                ><IconTile
                                    :icon="tagIcon"
                                    size="sm"
                                    tone="sage"
                            /></template>
                            {{ tag.name }}
                            <template #subtitle>
                                {{
                                    tag.usage_count === 1
                                        ? t(':count post', {
                                              count: tag.usage_count,
                                          })
                                        : t(':count posts', {
                                              count: tag.usage_count,
                                          })
                                }}
                            </template>
                        </ListItem>
                    </li>
                </ul>

                <SurfaceCard v-else-if="tags.length === 0" class="reveal-item">
                    <div
                        class="flex flex-col items-center px-2 py-4 text-center"
                    >
                        <IconTile
                            :icon="tagIcon"
                            size="lg"
                            tone="sage"
                            class="mb-4"
                        />
                        <h3
                            class="font-sans text-lg font-semibold text-teal dark:text-sand-100"
                        >
                            {{ t('No tags yet') }}
                        </h3>
                        <p class="mt-1 text-sand-600 dark:text-sand-400">
                            {{
                                t(
                                    'Create tags to organize and filter your posts.',
                                )
                            }}
                        </p>
                        <div class="mt-5">
                            <Button size="md" @click="showCreateForm = true">
                                {{ t('Create your first tag') }}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        </div>
    </AppLayout>
</template>
