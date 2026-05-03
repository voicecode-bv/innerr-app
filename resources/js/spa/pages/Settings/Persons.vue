<script setup lang="ts">
import { Camera, Dialog, Events, Off, On } from '@nativephp/mobile';
import {
    computed,
    onMounted,
    onUnmounted,
    ref,
    useTemplateRef,
    watch,
} from 'vue';
import { useRouter } from 'vue-router';
import BottomSheet from '@/components/BottomSheet.vue';
import Button from '@/components/Button.vue';
import CirclePicker from '@/components/CirclePicker.vue';
import IconTile from '@/components/IconTile.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import ListItem from '@/spa/components/ListItem.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useCirclesStore } from '@/spa/stores/circles';
import { usePersonsStore } from '@/spa/stores/persons';
import { api, ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import cakeIcon from '../../../../svg/doodle-icons/cake.svg';
import cameraIcon from '../../../../svg/doodle-icons/camera.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

interface Person {
    id: number;
    name: string;
    birthdate: string | null;
    avatar: string | null;
    avatar_thumbnail: string | null;
    usage_count: number;
    user_id?: number | null;
    circle_ids?: number[];
}

interface Circle {
    id: number;
    name: string;
    photo?: string | null;
    is_owner?: boolean;
    members_can_invite?: boolean;
}

const { t } = useTranslations();
const router = useRouter();
const circlesStore = useCirclesStore();
const personsStore = usePersonsStore();

const persons = computed<Person[]>(() =>
    (personsStore.items ?? []).filter((p) => !p.user_id),
);
const circles = computed<Circle[]>(() =>
    (circlesStore.items ?? []).filter(
        (circle) =>
            circle.is_owner === true || circle.members_can_invite === true,
    ),
);
const isLoading = ref(true);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

async function loadData(force = false): Promise<void> {
    try {
        if (force) {
            personsStore.invalidate();
            circlesStore.invalidate();
        }
        await Promise.all([
            personsStore.ensureLoaded(),
            circlesStore.ensureLoaded(),
        ]);
    } catch {
        // ignore
    } finally {
        isLoading.value = false;
    }
}

async function refresh(): Promise<void> {
    // Sluit edit-sheet zodat we geen stale draft tonen na server-state-update.
    sheetOpen.value = false;
    await loadData(true);
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: refresh,
    containerRef,
});

onMounted(loadData);

const selectedCircleIds = ref<number[]>([]);

function defaultCreateCircleIds(): number[] {
    return circles.value
        .filter((circle) => circle.is_owner === true)
        .map((circle) => circle.id);
}

const editingPersonId = ref<number | null>(null);
const editingPerson = computed<Person | null>(() => {
    if (editingPersonId.value === null) {
        return null;
    }
    return persons.value.find((p) => p.id === editingPersonId.value) ?? null;
});

const sheetOpen = ref(false);
const photoUploading = ref(false);
const pendingPhotoPath = ref<string | null>(null);
const pendingPhotoPreview = ref<string | null>(null);

const editForm = useApiForm(
    {
        name: '',
        birthdate: '' as string | null,
        circle_ids: [] as number[],
    },
    externalApi,
);

const formError = ref<string | null>(null);
const isCreating = ref(false);

function openCreate(): void {
    editingPersonId.value = null;
    pendingPhotoPath.value = null;
    pendingPhotoPreview.value = null;
    formError.value = null;
    selectedCircleIds.value = defaultCreateCircleIds();
    editForm.reset();
    editForm.data.circle_ids = selectedCircleIds.value;
    sheetOpen.value = true;
}

function openEdit(person: Person): void {
    editingPersonId.value = person.id;
    pendingPhotoPath.value = null;
    pendingPhotoPreview.value = null;
    formError.value = null;
    selectedCircleIds.value = [...(person.circle_ids ?? [])];
    editForm.data.name = person.name;
    editForm.data.birthdate = person.birthdate ?? '';
    editForm.data.circle_ids = selectedCircleIds.value;
    editForm.errors = {};
    sheetOpen.value = true;
}

function closeSheet(): void {
    sheetOpen.value = false;
}

async function syncCircleIds(
    personId: number,
    current: number[],
    desired: number[],
): Promise<void> {
    const desiredUnique = Array.from(new Set(desired.map((id) => Number(id))));
    const currentUnique = Array.from(new Set(current.map((id) => Number(id))));

    const toAttach = desiredUnique.filter((id) => !currentUnique.includes(id));
    const toDetach = currentUnique.filter((id) => !desiredUnique.includes(id));

    for (const circleId of toAttach) {
        await externalApi.post(`/persons/${personId}/circles/${circleId}`);
    }
    for (const circleId of toDetach) {
        await externalApi.delete(`/persons/${personId}/circles/${circleId}`);
    }
}

async function submit(): Promise<void> {
    formError.value = null;

    if (editingPerson.value === null) {
        await createPerson();
        return;
    }

    editForm.data.name = editForm.data.name.trim();
    if (editForm.data.birthdate === '') {
        editForm.data.birthdate = null;
    }

    const personId = editingPerson.value.id;
    const currentCircleIds = editingPerson.value.circle_ids ?? [];

    try {
        await externalApi.put(`/persons/${personId}`, {
            name: editForm.data.name,
            birthdate: editForm.data.birthdate,
        });
        await syncCircleIds(
            personId,
            currentCircleIds,
            selectedCircleIds.value,
        );
        sheetOpen.value = false;
        await loadData(true);
    } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
            editForm.errors = Object.fromEntries(
                Object.entries(error.errors).map(([k, v]) => [k, v[0] ?? '']),
            );
            if (
                !editForm.errors.name &&
                !editForm.errors.birthdate &&
                !editForm.errors.circle_ids
            ) {
                formError.value = error.message;
            }
        } else {
            formError.value =
                (error as Error).message ?? t('Failed to update person');
        }
    }
}

async function createPerson(): Promise<void> {
    if (!editForm.data.name.trim() || isCreating.value) {
        return;
    }

    if (selectedCircleIds.value.length === 0) {
        editForm.errors = {
            ...editForm.errors,
            circle_ids: t('Select at least one circle.'),
        };
        return;
    }

    isCreating.value = true;

    try {
        const data = await externalApi.post<{ data: Person }>('/persons', {
            name: editForm.data.name.trim(),
            birthdate:
                editForm.data.birthdate === '' ? null : editForm.data.birthdate,
            circle_ids: selectedCircleIds.value,
        });

        if (pendingPhotoPath.value) {
            photoUploading.value = true;
            try {
                await api.post(
                    `/api/spa/settings/persons/${data.data.id}/photo`,
                    {
                        photo_path: pendingPhotoPath.value,
                    },
                );
            } finally {
                photoUploading.value = false;
            }
            pendingPhotoPath.value = null;
            pendingPhotoPreview.value = null;
        }

        editingPersonId.value = data.data.id;
        sheetOpen.value = false;
        await loadData(true);
    } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
            editForm.errors = Object.fromEntries(
                Object.entries(error.errors).map(([k, v]) => [k, v[0] ?? '']),
            );
            if (
                !editForm.errors.name &&
                !editForm.errors.birthdate &&
                !editForm.errors.circle_ids
            ) {
                formError.value = error.message;
            }
        } else {
            formError.value = t('Failed to add person');
        }
    } finally {
        isCreating.value = false;
    }
}

let pendingDeletePersonId: number | null = null;

async function confirmDelete(person: Person): Promise<void> {
    if (person.user_id) {
        return;
    }

    pendingDeletePersonId = person.id;

    const message =
        person.usage_count > 0
            ? t(
                  '":name" is linked to :count posts. Removing this person also removes the link from those posts.',
                  {
                      name: person.name,
                      count: person.usage_count,
                  },
              )
            : t('Are you sure you want to remove ":name"?', {
                  name: person.name,
              });

    await Dialog.alert()
        .confirm(t('Remove person'), message)
        .id('delete-person-confirm');
}

async function handleButtonPressed(payload: {
    index: number;
    id?: string | null;
}): Promise<void> {
    if (
        payload.id !== 'delete-person-confirm' ||
        payload.index !== 1 ||
        pendingDeletePersonId === null
    ) {
        return;
    }

    const personId = pendingDeletePersonId;
    pendingDeletePersonId = null;

    try {
        await externalApi.delete(`/persons/${personId}`);
        if (editingPersonId.value === personId) {
            sheetOpen.value = false;
        }
        await loadData(true);
    } catch {
        // ignore — gebruiker blijft op de huidige lijst
    }
}

async function pickPhoto(): Promise<void> {
    await Camera.pickImages().all();
}

async function deletePhoto(): Promise<void> {
    pendingPhotoPath.value = null;
    pendingPhotoPreview.value = null;

    if (editingPerson.value === null) {
        return;
    }

    try {
        await externalApi.delete(`/persons/${editingPerson.value.id}/avatar`);
        await loadData(true);
    } catch {
        // ignore — foto blijft staan
    }
}

async function loadPreview(path: string): Promise<string | null> {
    try {
        const response = await fetch(
            `/native-media?path=${encodeURIComponent(path)}`,
        );
        if (!response.ok) {
            return null;
        }
        const { data_url } = await response.json();
        return data_url;
    } catch {
        return null;
    }
}

async function handleMediaSelected(payload: {
    success: boolean;
    files: { path: string; mimeType: string }[];
    cancelled: boolean;
}): Promise<void> {
    if (!payload.success || payload.cancelled || !payload.files.length) {
        return;
    }

    const path = payload.files[0].path;

    if (editingPerson.value === null) {
        pendingPhotoPath.value = path;
        pendingPhotoPreview.value = await loadPreview(path);
        return;
    }

    pendingPhotoPath.value = path;
    const preview = await loadPreview(path);
    pendingPhotoPreview.value = preview;
    photoUploading.value = true;

    const personId = editingPerson.value.id;
    const previous = personsStore.items?.find((p) => p.id === personId);
    if (preview) {
        personsStore.update(personId, {
            avatar: preview,
            avatar_thumbnail: preview,
        });
    }

    try {
        await api.post(`/api/spa/settings/persons/${personId}/photo`, {
            photo_path: path,
        });
        await loadData(true);
        pendingPhotoPath.value = null;
        pendingPhotoPreview.value = null;
    } catch {
        if (previous) personsStore.update(personId, previous);
    } finally {
        photoUploading.value = false;
    }
}

function formatBirthdate(date: string | null): string {
    if (!date) {
        return '';
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return date;
    }

    return parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

const todayIso = new Date().toISOString().slice(0, 10);

watch(sheetOpen, (open) => {
    if (!open) {
        editingPersonId.value = null;
        pendingPhotoPath.value = null;
        pendingPhotoPreview.value = null;
        formError.value = null;
    }
});

onMounted(() => {
    On(Events.Alert.ButtonPressed, handleButtonPressed);
    On(Events.Gallery.MediaSelected, handleMediaSelected);
});

onUnmounted(() => {
    Off(Events.Alert.ButtonPressed, handleButtonPressed);
    Off(Events.Gallery.MediaSelected, handleMediaSelected);
});

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
    <AppLayout ref="layout" :title="t('Persons')">
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
                :aria-label="t('Add person')"
                @click="openCreate"
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
                        d="M12 4.5v15m7.5-7.5h-15"
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
                <p class="reveal-item text-sand-600 dark:text-sand-400">
                    {{
                        t(
                            "Add people here who don't have an Innerr account so you can still tag them in your photos. Members of your circles are automatically taggable and don't need to be added.",
                        )
                    }}
                </p>

                <ul
                    v-if="isLoading && persons.length === 0"
                    class="reveal-item divide-y divide-sand-100 overflow-hidden rounded-lg bg-white/70 backdrop-blur-sm dark:divide-sand-700/60 dark:bg-sand-800/60"
                >
                    <li
                        v-for="n in 5"
                        :key="n"
                        class="flex animate-pulse items-center gap-4 px-4 py-4"
                    >
                        <div
                            class="size-12 shrink-0 rounded-full bg-sand-200 dark:bg-sand-700"
                        />
                        <div class="flex-1 space-y-2">
                            <div
                                class="h-3 w-32 rounded bg-sand-200 dark:bg-sand-700"
                            />
                            <div
                                class="h-2 w-20 rounded bg-sand-200 dark:bg-sand-700"
                            />
                        </div>
                    </li>
                </ul>

                <ul
                    v-else-if="persons.length > 0"
                    class="divide-y divide-sand-100 overflow-hidden rounded-lg dark:divide-sand-700/60"
                >
                    <li
                        v-for="person in persons"
                        :key="person.id"
                        class="reveal-item"
                    >
                        <ListItem
                            :show-chevron="false"
                            @click="openEdit(person)"
                        >
                            <template #leading>
                                <img
                                    v-if="person.avatar_thumbnail"
                                    :src="person.avatar_thumbnail"
                                    :alt="person.name"
                                    class="size-12 shrink-0 rounded-full object-cover"
                                />
                                <span
                                    v-else
                                    class="flex size-12 shrink-0 items-center justify-center rounded-full bg-sage-100 text-teal dark:bg-sage-900/40"
                                >
                                    <span
                                        aria-hidden="true"
                                        class="inline-block size-7 bg-current"
                                        :style="iconMaskStyle(userIcon)"
                                    ></span>
                                </span>
                            </template>
                            {{ person.name }}
                            <template #subtitle>
                                <span
                                    v-if="person.birthdate"
                                    class="inline-flex items-center gap-1.5"
                                >
                                    <span
                                        aria-hidden="true"
                                        class="inline-block size-3.5 bg-current"
                                        :style="iconMaskStyle(cakeIcon)"
                                    ></span>
                                    {{ formatBirthdate(person.birthdate) }}
                                </span>
                                <template v-else>
                                    {{
                                        person.usage_count === 1
                                            ? t(':count post', {
                                                  count: person.usage_count,
                                              })
                                            : t(':count posts', {
                                                  count: person.usage_count,
                                              })
                                    }}
                                </template>
                            </template>
                        </ListItem>
                    </li>
                </ul>

                <SurfaceCard v-else-if="!isLoading" class="reveal-item">
                    <div
                        class="flex flex-col items-center px-2 py-4 text-center"
                    >
                        <IconTile
                            :icon="userIcon"
                            size="lg"
                            tone="sage"
                            class="mb-4"
                        />
                        <h3
                            class="font-sans text-lg font-semibold text-teal dark:text-sand-100"
                        >
                            {{ t('No persons yet') }}
                        </h3>
                        <p class="mt-1 text-sand-600 dark:text-sand-400">
                            {{
                                t(
                                    'Add the people closest to you to tag them in your posts.',
                                )
                            }}
                        </p>
                        <div class="mt-5">
                            <Button size="md" @click="openCreate">
                                {{ t('Add your first person') }}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        </div>

        <BottomSheet
            :open="sheetOpen"
            @update:open="(value) => (sheetOpen = value)"
        >
            <template #header>
                <div class="flex items-center justify-between">
                    <h2 class="font-semibold text-sand-700 dark:text-sand-300">
                        {{ editingPerson ? t('Edit person') : t('Add person') }}
                    </h2>
                    <button
                        class="text-sand-500 dark:text-sand-400"
                        :aria-label="t('Close')"
                        @click="closeSheet"
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
                                d="M6 18 18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </template>

            <div class="space-y-5 px-4 py-5">
                <div class="flex flex-col items-center gap-3">
                    <button
                        class="relative"
                        :aria-label="t('Change photo')"
                        :disabled="photoUploading"
                        @click="pickPhoto"
                    >
                        <img
                            v-if="pendingPhotoPreview ?? editingPerson?.avatar"
                            :src="
                                pendingPhotoPreview ??
                                editingPerson?.avatar ??
                                ''
                            "
                            :alt="editingPerson?.name ?? ''"
                            class="size-24 rounded-full object-cover shadow-sm"
                            :class="photoUploading ? 'opacity-50' : ''"
                        />
                        <span
                            v-else
                            class="flex size-24 items-center justify-center rounded-full bg-sage-100 text-teal dark:bg-sage-900/40"
                            :class="photoUploading ? 'opacity-50' : ''"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-12 bg-current"
                                :style="iconMaskStyle(userIcon)"
                            ></span>
                        </span>
                        <span
                            class="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-teal shadow-md ring-4 ring-white/70 dark:ring-sand-900"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-4 bg-white"
                                :style="iconMaskStyle(cameraIcon)"
                            ></span>
                        </span>
                    </button>
                    <button
                        v-if="pendingPhotoPreview || editingPerson?.avatar"
                        type="button"
                        class="text-sand-500 hover:text-blush-500 dark:text-sand-400"
                        @click="deletePhoto"
                    >
                        {{ t('Remove photo') }}
                    </button>
                </div>

                <form class="space-y-4" @submit.prevent="submit">
                    <div>
                        <label
                            for="person-name"
                            class="tracking-wider text-sand-500 uppercase dark:text-sand-400"
                        >
                            {{ t('Name') }}
                        </label>
                        <input
                            id="person-name"
                            v-model="editForm.data.name"
                            type="text"
                            class="mt-2 box-border field min-w-0"
                            maxlength="50"
                            autofocus
                        />
                        <p
                            v-if="editForm.errors.name"
                            class="mt-1 text-blush-500"
                        >
                            {{ editForm.errors.name }}
                        </p>
                    </div>

                    <div>
                        <label
                            for="person-birthdate"
                            class="tracking-wider text-sand-500 uppercase dark:text-sand-400"
                        >
                            {{ t('Birthdate') }}
                        </label>
                        <input
                            id="person-birthdate"
                            v-model="editForm.data.birthdate"
                            type="date"
                            :max="todayIso"
                            min="1900-01-02"
                            class="mt-2 box-border block field w-full min-w-0 appearance-none"
                        />
                        <p
                            v-if="editForm.errors.birthdate"
                            class="mt-1 text-blush-500"
                        >
                            {{ editForm.errors.birthdate }}
                        </p>
                    </div>

                    <div v-if="circles.length > 0">
                        <CirclePicker
                            :circles="circles"
                            :selected-ids="selectedCircleIds"
                            :error="editForm.errors.circle_ids"
                            @update:selected-ids="selectedCircleIds = $event"
                        />
                    </div>

                    <p v-if="formError" class="text-blush-500">
                        {{ formError }}
                    </p>
                </form>
            </div>

            <template #footer>
                <div class="flex items-center justify-between gap-3 px-4 py-3">
                    <Button
                        v-if="editingPerson && !editingPerson.user_id"
                        type="button"
                        variant="danger"
                        size="md"
                        @click="confirmDelete(editingPerson)"
                    >
                        {{ t('Remove') }}
                    </Button>
                    <span v-else />
                    <div class="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            @click="closeSheet"
                        >
                            {{ t('Cancel') }}
                        </Button>
                        <Button
                            type="button"
                            size="md"
                            :disabled="
                                editForm.processing ||
                                isCreating ||
                                !editForm.data.name.trim() ||
                                selectedCircleIds.length === 0
                            "
                            @click="submit"
                        >
                            {{ editingPerson ? t('Save') : t('Add') }}
                        </Button>
                    </div>
                </div>
            </template>
        </BottomSheet>
    </AppLayout>
</template>
