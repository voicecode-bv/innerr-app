<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi, ApiError } from '@/spa/http/externalApi';

interface Tag {
    id: string;
    name: string;
    usage_count?: number;
}

const props = withDefaults(
    defineProps<{
        availableTags?: Tag[] | null;
        selectedIds: string[];
        error?: string | null;
    }>(),
    {
        availableTags: () => [],
        error: null,
    },
);

const emit = defineEmits<{
    (e: 'update:selectedIds', value: string[]): void;
    (e: 'tag-created', value: Tag): void;
}>();

const { t } = useTranslations();

const query = ref('');
const isOpen = ref(false);
const isCreating = ref(false);
const createError = ref<string | null>(null);
const localTags = ref<Tag[]>([]);
const inputRef = ref<HTMLInputElement | null>(null);
const activeIndex = ref(0);

const tags = computed<Tag[]>(() => {
    const seen = new Set<string>();
    const merged: Tag[] = [];

    for (const tag of [...(props.availableTags ?? []), ...localTags.value]) {
        if (seen.has(tag.id)) {
continue;
}

        seen.add(tag.id);
        merged.push(tag);
    }

    return merged.sort(
        (a, b) =>
            (b.usage_count ?? 0) - (a.usage_count ?? 0) ||
            a.name.localeCompare(b.name),
    );
});

const tagsById = computed(() => {
    const map = new Map<string, Tag>();

    for (const tag of tags.value) {
        map.set(tag.id, tag);
    }

    return map;
});

const selectedTags = computed<Tag[]>(() =>
    props.selectedIds
        .map((id) => tagsById.value.get(id))
        .filter((tag): tag is Tag => tag !== undefined),
);

const trimmedQuery = computed(() => query.value.trim().toLowerCase());

const filteredTags = computed<Tag[]>(() => {
    const q = trimmedQuery.value;

    return tags.value.filter((tag) => {
        if (props.selectedIds.includes(tag.id)) {
return false;
}

        if (q === '') {
return true;
}

        return tag.name.toLowerCase().includes(q);
    });
});

const exactMatch = computed(() =>
    tags.value.some((tag) => tag.name.toLowerCase() === trimmedQuery.value),
);

const canCreate = computed(
    () => trimmedQuery.value !== '' && !exactMatch.value && !isCreating.value,
);

const optionsCount = computed(
    () => filteredTags.value.length + (canCreate.value ? 1 : 0),
);

function openDropdown(): void {
    isOpen.value = true;
    activeIndex.value = 0;
}

function closeDropdown(): void {
    isOpen.value = false;
}

function selectTag(tagId: string): void {
    if (props.selectedIds.includes(tagId)) {
return;
}

    emit('update:selectedIds', [...props.selectedIds, tagId]);
    query.value = '';
    activeIndex.value = 0;
    nextTick(() => inputRef.value?.focus());
}

function removeTag(tagId: string): void {
    emit(
        'update:selectedIds',
        props.selectedIds.filter((id) => id !== tagId),
    );
}

function onInput(event: Event): void {
    query.value = (event.target as HTMLInputElement).value.toLowerCase();
    activeIndex.value = 0;
    isOpen.value = true;
}

function onBackspace(): void {
    if (query.value === '' && props.selectedIds.length > 0) {
        removeTag(props.selectedIds[props.selectedIds.length - 1]);
    }
}

function moveActive(delta: number): void {
    if (optionsCount.value === 0) {
return;
}

    isOpen.value = true;
    activeIndex.value =
        (activeIndex.value + delta + optionsCount.value) % optionsCount.value;
}

function commitActive(): void {
    if (!isOpen.value) {
        isOpen.value = true;

        return;
    }

    if (activeIndex.value < filteredTags.value.length) {
        selectTag(filteredTags.value[activeIndex.value].id);

        return;
    }

    if (canCreate.value) {
        createTag();
    }
}

async function createTag(): Promise<void> {
    if (!canCreate.value) {
return;
}

    isCreating.value = true;
    createError.value = null;
    const name = trimmedQuery.value;

    try {
        const response = await externalApi.post<{ data: Tag }>('/tags', {
            name,
        });
        const tag = response.data;
        localTags.value.push(tag);
        emit('tag-created', tag);
        emit('update:selectedIds', [...props.selectedIds, tag.id]);
        query.value = '';
        activeIndex.value = 0;
    } catch (error) {
        if (error instanceof ApiError && error.errors.name) {
            createError.value = error.errors.name[0];
        } else {
            createError.value = t('Failed to create tag');
        }
    } finally {
        isCreating.value = false;
    }
}
</script>

<template>
    <div>
        <p class="mb-3 font-semibold text-ink">
            {{ t('Tags') }}
        </p>

        <div
            class="relative rounded-2xl bg-sand-100 px-2 py-2 shadow-sm focus-within:ring-2 focus-within:ring-action"
            @click="inputRef?.focus()"
        >
            <div class="flex flex-wrap items-center gap-2">
                <span
                    v-for="tag in selectedTags"
                    :key="tag.id"
                    class="inline-flex items-center gap-1 rounded-full bg-action px-3 py-1 text-white shadow-sm"
                >
                    {{ tag.name }}
                    <button
                        type="button"
                        class="-mr-1 flex h-4 w-4 items-center justify-center rounded-full text-white/80 hover:bg-surface/20 hover:text-white"
                        :aria-label="t('Remove tag')"
                        @click.stop="removeTag(tag.id)"
                    >
                        <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-3 w-3"
                        >
                            <path
                                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
                            />
                        </svg>
                    </button>
                </span>

                <input
                    ref="inputRef"
                    :value="query"
                    type="text"
                    maxlength="50"
                    :placeholder="
                        selectedTags.length === 0
                            ? t('Search or add tags...')
                            : ''
                    "
                    class="min-w-[8rem] flex-1 border-0 bg-transparent px-2 py-1 text-ink placeholder-ink-muted/50 focus:ring-0 focus:outline-none"
                    @input="onInput"
                    @focus="openDropdown"
                    @blur="closeDropdown"
                    @keydown.enter.prevent="commitActive"
                    @keydown.down.prevent="moveActive(1)"
                    @keydown.up.prevent="moveActive(-1)"
                    @keydown.esc.prevent="closeDropdown"
                    @keydown.delete="onBackspace"
                />
            </div>

            <ul
                v-if="isOpen && optionsCount > 0"
                class="absolute top-full right-0 left-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-xl bg-surface py-1 shadow-lg ring-1 ring-sand-200"
                @mousedown.prevent
            >
                <li
                    v-for="(tag, index) in filteredTags"
                    :key="tag.id"
                    class="cursor-pointer px-4 py-2 text-ink"
                    :class="index === activeIndex ? 'bg-sand-100' : ''"
                    @mouseenter="activeIndex = index"
                    @click="selectTag(tag.id)"
                >
                    {{ tag.name }}
                </li>

                <li
                    v-if="canCreate"
                    class="flex cursor-pointer items-center gap-2 px-4 py-2 text-ink"
                    :class="
                        filteredTags.length === activeIndex ? 'bg-sand-100' : ''
                    "
                    @mouseenter="activeIndex = filteredTags.length"
                    @click="createTag"
                >
                    <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        class="h-4 w-4"
                    >
                        <path
                            d="M10 3.75a.75.75 0 0 1 .75.75v4.75h4.75a.75.75 0 0 1 0 1.5h-4.75v4.75a.75.75 0 0 1-1.5 0V10.75H4.5a.75.75 0 0 1 0-1.5h4.75V4.5a.75.75 0 0 1 .75-.75Z"
                        />
                    </svg>
                    {{
                        isCreating
                            ? t('Adding...')
                            : t('Create ":name"', { name: trimmedQuery })
                    }}
                </li>
            </ul>
        </div>

        <p v-if="createError" class="mt-2 text-destructive-ink">{{ createError }}</p>
        <p v-if="error" class="mt-2 text-destructive-ink">{{ error }}</p>
    </div>
</template>
