<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue';
import BottomSheet from '@/components/BottomSheet.vue';
import CirclePicker from '@/components/CirclePicker.vue';
import PersonPicker from '@/components/PersonPicker.vue';

const TagSelector = defineAsyncComponent(
    () => import('@/spa/components/TagSelector.vue'),
);
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { externalApi } from '@/spa/http/externalApi';

interface Circle {
    id: string;
    name: string;
    photo?: string | null;
    members_count?: number;
    members_can_invite?: boolean;
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
        availableCircles?: Circle[] | null;
        tags?: Tag[] | null;
        persons?: Person[] | null;
        availableTags?: Tag[] | null;
        availablePersons?: Person[] | null;
    }>(),
    {
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
}>();

const { t } = useTranslations();

const initialTagIds = (props.tags ?? []).map((tag) => tag.id);
const initialPersonIds = (props.persons ?? []).map((person) => person.id);

const form = useApiForm(
    {
        caption: props.caption ?? '',
        circle_ids: props.circles.map((c) => c.id),
        tag_ids: initialTagIds,
        person_ids: initialPersonIds,
    },
    externalApi,
);

const availableCircles = computed<Circle[]>(() => props.availableCircles ?? []);
const availableTags = computed<Tag[]>(() => props.availableTags ?? []);
const allPersons = computed<Person[]>(() => props.availablePersons ?? []);
const availablePersons = computed<Person[]>(() => {
    const selected = form.data.circle_ids;
    if (selected.length === 0) return [];
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
        if (form.data.person_ids.length === 0) return;
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
            (id) => visibleIds.has(id) || initialPersonIds.includes(id),
        );
    },
);

function sameIds(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((id, i) => id === sortedB[i]);
}

const hasChanges = computed(() => {
    if ((form.data.caption ?? '') !== (props.caption ?? '')) return true;
    if (
        !sameIds(
            form.data.circle_ids,
            props.circles.map((c) => c.id),
        )
    )
        return true;
    if (!sameIds(form.data.tag_ids, initialTagIds)) return true;
    if (!sameIds(form.data.person_ids, initialPersonIds)) return true;
    return false;
});

const canSave = computed(
    () =>
        form.data.circle_ids.length > 0 && hasChanges.value && !form.processing,
);

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;

        form.errors = {};
        form.data.caption = props.caption ?? '';
        form.data.circle_ids = props.circles.map((c) => c.id);
        form.data.tag_ids = (props.tags ?? []).map((tag) => tag.id);
        form.data.person_ids = (props.persons ?? []).map((person) => person.id);
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

async function submit(): Promise<void> {
    const payload = {
        caption: form.data.caption,
        circle_ids: form.data.circle_ids,
        tag_ids: form.data.tag_ids,
        person_ids: form.data.person_ids,
    };

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
                <h2 class="font-semibold text-sand-700 dark:text-sand-300">
                    {{ t('Edit post') }}
                </h2>
                <button
                    class="text-sand-500 dark:text-sand-400"
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
                <label
                    for="edit-post-caption"
                    class="tracking-wider text-sand-500 uppercase dark:text-sand-400"
                >
                    {{ t('Caption') }}
                </label>
                <textarea
                    id="edit-post-caption"
                    v-model="form.data.caption"
                    :placeholder="t('Write a caption...')"
                    rows="4"
                    maxlength="2200"
                    class="mt-2 w-full resize-none border-0 bg-transparent p-0 text-base text-sand-800 placeholder-sand-400 focus:ring-0 focus:outline-none dark:text-sand-100 dark:placeholder-sand-500"
                />
                <p v-if="form.errors.caption" class="mt-1 text-blush-500">
                    {{ form.errors.caption }}
                </p>
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
        </div>

        <template #footer>
            <div class="px-4 py-3">
                <button
                    :disabled="!canSave"
                    class="flex w-full items-center justify-center gap-2 rounded-lg bg-teal py-3 font-semibold text-white shadow-sm transition-colors hover:bg-teal-light disabled:opacity-40"
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
                </button>
            </div>
        </template>
    </BottomSheet>
</template>
