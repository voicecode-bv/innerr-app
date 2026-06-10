<script setup lang="ts">
import {
    computed,
    defineAsyncComponent,
    onMounted,
    onUnmounted,
    ref,
    watch,
} from 'vue';
import BottomSheet from '@/components/BottomSheet.vue';
import Button from '@/components/Button.vue';
import CirclePicker from '@/components/CirclePicker.vue';
import PersonPicker from '@/components/PersonPicker.vue';

const TagSelector = defineAsyncComponent(
    () => import('@/spa/components/TagSelector.vue'),
);
const LocationPickerSheet = defineAsyncComponent(
    () => import('@/spa/components/LocationPickerSheet.vue'),
);
import { useApiForm } from '@/spa/composables/useApiForm';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { Dialog, Events, Off, On } from '@nativephp/mobile';

interface Circle {
    id: string;
    name: string;
    photo?: string | null;
    members_count?: number;
    members_can_invite?: boolean;
    members_can_view_members?: boolean;
    is_owner?: boolean;
}

interface Tag {
    id: string;
    name: string;
    usage_count?: number;
}

interface Person {
    id: string;
    name: string;
    avatar?: string | null;
    avatar_thumbnail?: string | null;
    user_id?: string | null;
    circle_ids?: string[];
}

const props = withDefaults(
    defineProps<{
        open: boolean;
        postId: string;
        caption: string | null;
        circles: Circle[];
        location?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        availableCircles?: Circle[] | null;
        tags?: Tag[] | null;
        persons?: Person[] | null;
        availableTags?: Tag[] | null;
        availablePersons?: Person[] | null;
    }>(),
    {
        location: null,
        latitude: null,
        longitude: null,
        availableCircles: () => [],
        tags: () => [],
        persons: () => [],
        availableTags: () => [],
        availablePersons: () => [],
    },
);

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'updated'): void;
    (e: 'deleted', postId: string): void;
}>();

const DELETE_CONFIRM_ID = 'edit-post-delete-confirm';

const { t } = useTranslations();

const initialTagIds = ref<string[]>((props.tags ?? []).map((tag) => tag.id));
const initialPersonIds = ref<string[]>(
    (props.persons ?? []).map((person) => person.id),
);
const initialCircleIds = ref<string[]>(props.circles.map((c) => c.id));
const initialCaption = ref<string>(props.caption ?? '');

// Location lives outside the api-form so the picker can set the name and the
// lat/lng together; we still diff it for `hasChanges` and only send it when it
// actually changed.
const locationName = ref<string | null>(props.location ?? null);
const latitude = ref<number | null>(props.latitude ?? null);
const longitude = ref<number | null>(props.longitude ?? null);
const initialLocationName = ref<string | null>(props.location ?? null);
const initialLatitude = ref<number | null>(props.latitude ?? null);
const initialLongitude = ref<number | null>(props.longitude ?? null);
const isLocationPickerOpen = ref(false);

const hasLocation = computed(
    () => latitude.value !== null && longitude.value !== null,
);

const locationChanged = computed(
    () =>
        locationName.value !== initialLocationName.value ||
        latitude.value !== initialLatitude.value ||
        longitude.value !== initialLongitude.value,
);

function handleLocationConfirm(value: {
    latitude: number | null;
    longitude: number | null;
    location: string | null;
}): void {
    latitude.value = value.latitude;
    longitude.value = value.longitude;
    locationName.value = value.location;
}

const form = useApiForm(
    {
        caption: props.caption ?? '',
        circle_ids: [...initialCircleIds.value],
        tag_ids: [...initialTagIds.value],
        person_ids: [...initialPersonIds.value],
    },
    externalApi,
);

const availableCircles = computed<Circle[]>(() => props.availableCircles ?? []);
const availableTags = computed<Tag[]>(() => props.availableTags ?? []);
const allPersons = computed<Person[]>(() => props.availablePersons ?? []);
const availablePersons = computed<Person[]>(() => {
    const selected = form.data.circle_ids;

    if (selected.length === 0) {
        return [];
    }

    // Persons currently tagged on the post must remain visible (and selected)
    // even if they no longer overlap with the chosen circles, so the user can
    // explicitly deselect them.
    const visible = allPersons.value.filter((person) =>
        (person.circle_ids ?? []).some((id) => selected.includes(id)),
    );
    const visibleIds = new Set(visible.map((p) => p.id));
    const stillSelected = (props.persons ?? []).filter(
        (person) =>
            form.data.person_ids.includes(person.id) &&
            !visibleIds.has(person.id),
    );

    return [...visible, ...stillSelected];
});

watch(
    () => form.data.circle_ids,
    () => {
        if (form.data.person_ids.length === 0) {
            return;
        }

        const visibleIds = new Set(
            allPersons.value
                .filter((person) =>
                    (person.circle_ids ?? []).some((id) =>
                        form.data.circle_ids.includes(id),
                    ),
                )
                .map((p) => p.id),
        );
        // Keep originally-tagged persons selectable; drop only persons that
        // were just added in this session and lost their circle.
        form.data.person_ids = form.data.person_ids.filter(
            (id) => visibleIds.has(id) || initialPersonIds.value.includes(id),
        );
    },
);

function sameIds(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }

    const sortedA = [...a].sort();
    const sortedB = [...b].sort();

    return sortedA.every((id, i) => id === sortedB[i]);
}

const hasChanges = computed(() => {
    if ((form.data.caption ?? '') !== initialCaption.value) {
        return true;
    }

    if (!sameIds(form.data.circle_ids, initialCircleIds.value)) {
        return true;
    }

    if (!sameIds(form.data.tag_ids, initialTagIds.value)) {
        return true;
    }

    if (!sameIds(form.data.person_ids, initialPersonIds.value)) {
        return true;
    }

    if (locationChanged.value) {
        return true;
    }

    return false;
});

const canSave = computed(
    () =>
        form.data.circle_ids.length > 0 && hasChanges.value && !form.processing,
);

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) {
            return;
        }

        // Refresh baseline-snapshots zodat hasChanges altijd vergelijkt met
        // de actuele post-state (anders blijven oude tag/person ids hangen
        // tussen edit-sessies in op dezelfde gemounte modal).
        initialCaption.value = props.caption ?? '';
        initialCircleIds.value = props.circles.map((c) => c.id);
        initialTagIds.value = (props.tags ?? []).map((tag) => tag.id);
        initialPersonIds.value = (props.persons ?? []).map((p) => p.id);
        initialLocationName.value = props.location ?? null;
        initialLatitude.value = props.latitude ?? null;
        initialLongitude.value = props.longitude ?? null;

        form.errors = {};
        form.data.caption = initialCaption.value;
        form.data.circle_ids = [...initialCircleIds.value];
        form.data.tag_ids = [...initialTagIds.value];
        form.data.person_ids = [...initialPersonIds.value];
        locationName.value = initialLocationName.value;
        latitude.value = initialLatitude.value;
        longitude.value = initialLongitude.value;
    },
);

function close(): void {
    emit('update:open', false);
}

function onSheetUpdate(value: boolean): void {
    if (!value) {
        close();
    } else {
        emit('update:open', true);
    }
}

const isDeleting = ref(false);

async function requestDelete(): Promise<void> {
    if (isDeleting.value || form.processing) {
        return;
    }

    await Dialog.alert()
        .confirm(
            t('Delete post'),
            t('Are you sure you want to delete this post?'),
        )
        .id(DELETE_CONFIRM_ID);
}

async function handleButtonPressed(payload: {
    index: number;
    id?: string | null;
}): Promise<void> {
    if (payload.id !== DELETE_CONFIRM_ID || payload.index !== 1) {
        return;
    }

    if (isDeleting.value) {
        return;
    }

    isDeleting.value = true;

    try {
        await externalApi.delete(`/posts/${props.postId}`);
        emit('deleted', props.postId);
        close();
    } catch {
        // ignore — modal blijft open zodat de gebruiker opnieuw kan proberen
    } finally {
        isDeleting.value = false;
    }
}

onMounted(() => On(Events.Alert.ButtonPressed, handleButtonPressed));
onUnmounted(() => Off(Events.Alert.ButtonPressed, handleButtonPressed));

async function submit(): Promise<void> {
    const payload: Record<string, unknown> = {
        caption: form.data.caption,
        circle_ids: form.data.circle_ids,
        tag_ids: form.data.tag_ids,
        person_ids: form.data.person_ids,
    };

    // Only send location when it changed; latitude/longitude must travel
    // together (the API rejects one without the other).
    if (locationChanged.value) {
        payload.location = locationName.value;
        payload.latitude = latitude.value;
        payload.longitude = longitude.value;
    }

    form.processing = true;
    form.errors = {};

    try {
        await externalApi.put(`/posts/${props.postId}`, payload);
        emit('updated');
        close();
    } catch (error) {
        const apiError = error as {
            status?: number;
            errors?: Record<string, string[]>;
            message?: string;
        };

        if (apiError.status === 422) {
            form.errors = Object.fromEntries(
                Object.entries(apiError.errors ?? {}).map(([k, v]) => [
                    k,
                    v[0] ?? '',
                ]),
            );
        }
    } finally {
        form.processing = false;
    }
}
</script>

<template>
    <BottomSheet :open="open" @update:open="onSheetUpdate">
        <template #header>
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-ink">
                    {{ t('Edit post') }}
                </h2>
                <button
                    class="text-ink-muted"
                    :aria-label="t('Close')"
                    @click="close"
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

        <div class="space-y-5 px-4 py-4">
            <section>
                <label for="edit-post-caption" class="font-semibold text-ink">
                    {{ t('Caption') }}
                </label>
                <textarea
                    id="edit-post-caption"
                    v-model="form.data.caption"
                    :placeholder="t('Write a caption...')"
                    rows="4"
                    maxlength="2200"
                    class="mt-2 field-area"
                />
                <p v-if="form.errors.caption" class="mt-1 text-destructive-ink">
                    {{ form.errors.caption }}
                </p>
            </section>

            <section>
                <label class="font-semibold text-ink">
                    {{ t('Location') }}
                </label>
                <button
                    type="button"
                    class="mt-2 flex w-full items-center gap-3 rounded-xl border border-sand-200 px-4 py-3 text-left active:bg-sand-50"
                    @click="isLocationPickerOpen = true"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.75"
                        class="size-5 shrink-0 text-ink-muted"
                        aria-hidden="true"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                        />
                    </svg>
                    <span class="min-w-0 flex-1">
                        <span
                            v-if="hasLocation"
                            class="block truncate text-ink"
                        >
                            {{ locationName || t('Pinned location') }}
                        </span>
                        <span v-else class="block text-ink-muted">
                            {{ t('Add a location') }}
                        </span>
                    </span>
                    <span class="shrink-0 font-medium text-action">
                        {{ hasLocation ? t('Change') : t('Add') }}
                    </span>
                </button>
            </section>

            <section v-if="availableCircles.length > 0">
                <CirclePicker
                    :circles="availableCircles"
                    :selected-ids="form.data.circle_ids"
                    :error="form.errors.circle_ids"
                    @update:selected-ids="form.data.circle_ids = $event"
                />
            </section>

            <section v-if="availablePersons.length > 0">
                <PersonPicker
                    :persons="availablePersons"
                    :selected-ids="form.data.person_ids"
                    :error="form.errors.person_ids"
                    @update:selected-ids="form.data.person_ids = $event"
                />
            </section>

            <section class="relative z-20">
                <TagSelector
                    :available-tags="availableTags"
                    :selected-ids="form.data.tag_ids"
                    :error="form.errors.tag_ids"
                    @update:selected-ids="form.data.tag_ids = $event"
                />
            </section>

            <section class="border-t border-sand-100 pt-5">
                <Button
                    variant="danger"
                    size="lg"
                    block
                    :disabled="isDeleting || form.processing"
                    @click="requestDelete"
                >
                    <svg
                        v-if="!isDeleting"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.75"
                        stroke="currentColor"
                        class="size-5"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                    </svg>
                    <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        class="size-5 animate-spin"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-opacity="0.25"
                        />
                        <path
                            d="M22 12a10 10 0 0 1-10 10"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                        />
                    </svg>
                    {{ isDeleting ? t('Deleting...') : t('Delete post') }}
                </Button>
            </section>
        </div>

        <template #footer>
            <div class="px-4 py-3">
                <Button
                    variant="primary"
                    size="lg"
                    block
                    :disabled="!canSave"
                    @click="submit"
                >
                    <svg
                        v-if="form.processing"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        class="size-4 animate-spin"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-opacity="0.25"
                        />
                        <path
                            d="M22 12a10 10 0 0 1-10 10"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                        />
                    </svg>
                    {{ form.processing ? t('Saving...') : t('Save') }}
                </Button>
            </div>
        </template>
    </BottomSheet>

    <LocationPickerSheet
        :open="isLocationPickerOpen"
        :latitude="latitude"
        :longitude="longitude"
        :location="locationName"
        @update:open="isLocationPickerOpen = $event"
        @confirm="handleLocationConfirm"
    />
</template>
