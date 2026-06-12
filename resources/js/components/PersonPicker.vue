<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import userIcon from '../../svg/doodle-icons/user.svg';

interface Person {
    id: string;
    name: string;
    avatar_thumbnail?: string | null;
    avatar?: string | null;
    user_id?: string | null;
}

const props = withDefaults(
    defineProps<{
        persons: Person[];
        selectedIds: string[];
        error?: string | null;
        defaultCollapsed?: boolean;
        layout?: 'scroll' | 'grid';
        title?: string | null;
        searchable?: boolean;
        collapsible?: boolean;
    }>(),
    {
        error: null,
        defaultCollapsed: false,
        layout: 'scroll',
        title: null,
        searchable: false,
        collapsible: true,
    },
);

const emit = defineEmits<{
    (e: 'update:selectedIds', value: string[]): void;
}>();

const { t } = useTranslations();

const isCollapsed = ref(props.collapsible && props.defaultCollapsed);

// By default only the tagged children (persons without their own account) are
// shown. The "show all" link reveals every person, including circle members
// who have their own account.
const showAll = ref(false);

const hasNonChildren = computed(() =>
    props.persons.some((person) => !!person.user_id),
);

const heading = computed(() => props.title ?? t('Tag persons'));

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

const summaryText = computed(() => {
    if (props.selectedIds.length === 0) {
        return t('No persons selected');
    }

    return t(':count selected', { count: String(props.selectedIds.length) });
});

const basePersons = computed(() =>
    showAll.value
        ? props.persons
        : props.persons.filter((person) => !person.user_id),
);

const sortedPersons = computed(() =>
    [...basePersons.value].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    ),
);

const query = ref('');

const displayedPersons = computed(() => {
    const q = query.value.trim().toLowerCase();

    if (!props.searchable || q === '') {
        return sortedPersons.value;
    }

    return sortedPersons.value.filter((person) =>
        person.name.toLowerCase().includes(q),
    );
});

function toggle(personId: string) {
    if (props.selectedIds.includes(personId)) {
        emit(
            'update:selectedIds',
            props.selectedIds.filter((id) => id !== personId),
        );
    } else {
        emit('update:selectedIds', [...props.selectedIds, personId]);
    }
}
</script>

<template>
    <div>
        <div class="mb-3 flex items-center justify-between gap-2">
            <button
                v-if="collapsible"
                type="button"
                class="flex items-center gap-1.5 font-semibold text-ink"
                @click="isCollapsed = !isCollapsed"
            >
                {{ heading }}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="size-3.5 transition-transform"
                    :class="isCollapsed ? '' : 'rotate-180'"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                </svg>
            </button>
            <span v-else class="font-semibold text-ink">{{ heading }}</span>

            <span
                v-if="collapsible && isCollapsed"
                class="truncate text-ink-muted"
                >{{ summaryText }}</span
            >
            <button
                v-else-if="hasNonChildren"
                type="button"
                class="hover:text-ink-light text-ink"
                @click="showAll = !showAll"
            >
                {{ showAll ? t('Show children only') : t('Show all people') }}
            </button>
        </div>

        <div v-if="!isCollapsed && persons.length === 0" class="text-ink-muted">
            {{ t('No persons yet. Add them in Settings under Children.') }}
        </div>

        <template v-else-if="!isCollapsed">
            <div v-if="searchable" class="relative mb-3">
                <input
                    v-model="query"
                    type="search"
                    :placeholder="t('Search persons')"
                    class="w-full rounded-lg border border-dark-sand bg-surface py-2 pr-10 pl-3 text-ink placeholder-ink-muted focus:border-action focus:ring-0 focus:outline-none"
                />
                <button
                    v-if="query"
                    type="button"
                    :aria-label="t('Clear search')"
                    class="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted transition-colors hover:text-ink"
                    @click="query = ''"
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
            </div>

            <p v-if="displayedPersons.length === 0" class="text-ink-muted">
                {{ t('No persons found.') }}
            </p>

            <div
                v-else
                :class="
                    layout === 'grid'
                        ? 'grid grid-cols-4 gap-x-3 gap-y-4'
                        : '-mx-1 no-scrollbar flex gap-3 overflow-x-auto px-1 pb-1'
                "
            >
                <button
                    v-for="person in displayedPersons"
                    :key="person.id"
                    type="button"
                    class="flex flex-col items-center gap-1.5"
                    :class="layout === 'grid' ? '' : 'shrink-0'"
                    @click="toggle(person.id)"
                >
                    <div
                        class="relative rounded-full p-[2px] transition-colors"
                        :class="
                            selectedIds.includes(person.id)
                                ? 'person-ring'
                                : 'bg-sand-200'
                        "
                    >
                        <div class="rounded-full bg-surface p-0.5">
                            <img
                                v-if="person.avatar_thumbnail || person.avatar"
                                :src="
                                    person.avatar_thumbnail ??
                                    person.avatar ??
                                    ''
                                "
                                :alt="person.name"
                                class="size-14 rounded-full object-cover transition-opacity"
                                :class="
                                    selectedIds.includes(person.id)
                                        ? ''
                                        : 'opacity-60'
                                "
                            />
                            <div
                                v-else
                                class="flex size-14 items-center justify-center rounded-full bg-sand-100 transition-opacity dark:bg-brand-blue"
                                :class="
                                    selectedIds.includes(person.id)
                                        ? ''
                                        : 'opacity-60'
                                "
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-7 bg-action dark:bg-ink"
                                    :style="iconMaskStyle(userIcon)"
                                ></span>
                            </div>
                        </div>

                        <div
                            v-if="selectedIds.includes(person.id)"
                            class="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full bg-action ring-2 ring-white"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="3"
                                stroke="currentColor"
                                class="size-3 text-white"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="m4.5 12.75 6 6 9-13.5"
                                />
                            </svg>
                        </div>
                    </div>
                    <span
                        class="max-w-16 truncate"
                        :class="
                            selectedIds.includes(person.id)
                                ? 'font-medium text-ink'
                                : 'text-ink-muted'
                        "
                    >
                        {{ person.name }}
                    </span>
                </button>
            </div>
        </template>

        <p v-if="error" class="mt-2 text-destructive-ink">{{ error }}</p>
    </div>
</template>

<style scoped>
.person-ring {
    background: conic-gradient(
        from 0deg,
        var(--color-accent),
        var(--color-accent-soft),
        var(--color-sage-400),
        var(--color-teal-muted),
        var(--color-accent)
    );
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

/* Hide the native search clear button; we show our own clear button. */
input[type='search']::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
}
</style>
