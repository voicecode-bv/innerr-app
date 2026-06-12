<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppText from '@/components/AppText.vue';
import BottomSheet from '@/components/BottomSheet.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useChildFilterStore } from '@/spa/stores/childFilter';
import type { Person } from '@/spa/stores/persons';
import { usePersonsStore } from '@/spa/stores/persons';
import userIcon from '../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const personsStore = usePersonsStore();
const childFilter = useChildFilterStore();

const open = ref(false);
// Working selection while the sheet is open; committed to the store on "apply".
const draftIds = ref<string[]>([]);

// "Children" = the persons you tag who don't have an app account themselves.
// Linked app users (own account, other parents) are excluded; they have a
// profile of their own instead of a timeline.
const children = computed<Person[]>(() =>
    [...(personsStore.items ?? [])]
        .filter((person) => !person.user_id)
        .sort((a, b) => a.name.localeCompare(b.name)),
);

const allChildIds = computed(() => children.value.map((child) => child.id));

const allSelected = computed(
    () =>
        allChildIds.value.length > 0 &&
        draftIds.value.length === allChildIds.value.length,
);

function toggleAll(): void {
    draftIds.value = allSelected.value ? [] : [...allChildIds.value];
}

// The filter currently applied to the feed. An empty store means "all children".
const appliedIds = computed<string[]>(() =>
    childFilter.selectedIds.length > 0
        ? childFilter.selectedIds
        : allChildIds.value,
);

// The trigger button shows the avatars of the first three applied children
// (overlapping) followed by their names.
const appliedChildren = computed<Person[]>(() =>
    children.value.filter((child) => appliedIds.value.includes(child.id)),
);

const previewChildren = computed<Person[]>(() =>
    appliedChildren.value.slice(0, 3),
);

const selectedNames = computed(() =>
    appliedChildren.value.map((child) => child.name).join(', '),
);

function openSheet(): void {
    void personsStore.ensureLoaded();
    // Reflect the currently applied filter when (re)opening the sheet.
    draftIds.value = [...appliedIds.value];
    open.value = true;
}

function isSelected(id: string): boolean {
    return draftIds.value.includes(id);
}

function toggleChild(id: string): void {
    draftIds.value = isSelected(id)
        ? draftIds.value.filter((selected) => selected !== id)
        : [...draftIds.value, id];
}

// Apply the selection to the current feed (list or grid) instead of navigating
// away. Selecting every child is stored as "all" (empty) so newly added
// children keep showing up without re-applying.
function applyFilter(): void {
    if (draftIds.value.length === 0) {
        return;
    }

    const isAll = draftIds.value.length === allChildIds.value.length;
    childFilter.setSelected(isAll ? [] : [...draftIds.value]);
    open.value = false;
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

onMounted(() => {
    void personsStore.ensureLoaded();
});
</script>

<template>
    <div>
        <button
            type="button"
            data-tour="feed.children-filter"
            :aria-label="t('Open a child timeline')"
            :aria-expanded="open"
            aria-haspopup="dialog"
            class="flex h-12 items-center justify-center gap-1 rounded-full px-1.5 text-accent transition-colors hover:bg-sand-100"
            @click="openSheet"
        >
            <span
                v-if="appliedChildren.length === 0"
                aria-hidden="true"
                class="inline-block size-6 bg-ink"
                :style="iconMaskStyle(userIcon)"
            ></span>

            <template v-else>
                <span class="flex -space-x-3">
                    <template v-for="child in previewChildren" :key="child.id">
                        <img
                            v-if="child.avatar_thumbnail"
                            :src="child.avatar_thumbnail"
                            :alt="child.name"
                            class="size-9 rounded-full object-cover ring-2 ring-sand"
                        />
                        <span
                            v-else
                            class="flex size-6 items-center justify-center rounded-full bg-brand-blue text-white ring-2 ring-sand"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-7 bg-current"
                                :style="iconMaskStyle(userIcon)"
                            ></span>
                        </span>
                    </template>
                </span>
                <span
                    class="ml-3 max-w-32 min-w-0 truncate text-base font-medium text-ink"
                >
                    {{ selectedNames }}
                </span>
            </template>
        </button>

        <BottomSheet :open="open" @update:open="open = $event">
            <template #header>
                <div class="flex items-center justify-between gap-3">
                    <AppText variant="heading" class="block">
                        {{ t('Select children') }}
                    </AppText>
                    <button
                        v-if="children.length > 0"
                        type="button"
                        class="shrink-0 text-sm font-medium text-accent transition-colors hover:text-accent/80"
                        @click="toggleAll"
                    >
                        {{
                            allSelected
                                ? t('Deselect everyone')
                                : t('Select everyone')
                        }}
                    </button>
                </div>
            </template>

            <div class="px-4 py-5">
                <p class="mb-5 text-sm text-ink-muted">
                    {{
                        t(
                            'These are all children from all circles you are a member of.',
                        )
                    }}
                </p>

                <div
                    v-if="children.length > 0"
                    class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4"
                >
                    <button
                        v-for="child in children"
                        :key="child.id"
                        type="button"
                        role="checkbox"
                        :aria-checked="isSelected(child.id)"
                        class="flex flex-col items-center gap-2"
                        @click="toggleChild(child.id)"
                    >
                        <span class="relative">
                            <img
                                v-if="child.avatar_thumbnail"
                                :src="child.avatar_thumbnail"
                                :alt="child.name"
                                class="size-20 rounded-full object-cover ring-2 transition"
                                :class="
                                    isSelected(child.id)
                                        ? 'ring-action'
                                        : 'opacity-50 ring-transparent'
                                "
                            />
                            <span
                                v-else
                                class="flex size-20 items-center justify-center rounded-full bg-brand-blue text-white ring-2 transition"
                                :class="
                                    isSelected(child.id)
                                        ? 'ring-action'
                                        : 'opacity-50 ring-transparent'
                                "
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-10 bg-current"
                                    :style="iconMaskStyle(userIcon)"
                                ></span>
                            </span>
                            <span
                                v-if="isSelected(child.id)"
                                class="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-action text-white ring-2 ring-sand"
                            >
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    class="size-4"
                                >
                                    <path d="M5 12l5 5L20 7" />
                                </svg>
                            </span>
                        </span>
                        <span
                            class="max-w-full truncate text-sm font-medium"
                            :class="
                                isSelected(child.id)
                                    ? 'text-ink'
                                    : 'text-ink-muted'
                            "
                        >
                            {{ child.name }}
                        </span>
                    </button>
                </div>

                <p v-else class="py-8 text-center text-sm text-ink-muted">
                    {{ t('No children yet') }}
                </p>
            </div>

            <template v-if="children.length > 0" #footer>
                <div class="px-4 pt-3">
                    <button
                        type="button"
                        :disabled="draftIds.length === 0"
                        class="w-full rounded-lg bg-action py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:opacity-40"
                        @click="applyFilter"
                    >
                        {{ t('View timeline') }}
                    </button>
                </div>
            </template>
        </BottomSheet>
    </div>
</template>
