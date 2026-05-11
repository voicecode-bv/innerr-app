<script setup lang="ts">
import { useTranslations } from '@/spa/composables/useTranslations';
import { computed, ref } from 'vue';
import userIcon from '../../svg/doodle-icons/user.svg';

interface Circle {
    id: string;
    name: string;
    photo?: string | null;
    members_count?: number;
    members_can_invite?: boolean;
    members_can_view_members?: boolean;
    is_owner?: boolean;
}

const props = withDefaults(
    defineProps<{
        circles: Circle[];
        selectedIds: string[];
        error?: string | null;
        defaultCollapsed?: boolean;
        layout?: 'scroll' | 'grid';
    }>(),
    {
        error: null,
        defaultCollapsed: false,
        layout: 'scroll',
    },
);

const emit = defineEmits<{
    (e: 'update:selectedIds', value: string[]): void;
}>();

const { t } = useTranslations();

const isCollapsed = ref(props.defaultCollapsed);

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

// Circles met afgeschermde leden-lijst zijn alleen zichtbaar voor de owner —
// een niet-eigenaar mag er niet naartoe posten omdat ze niet kunnen zien wie
// er mee leest.
const visibleCircles = computed(() =>
    props.circles.filter(
        (circle) =>
            circle.is_owner === true ||
            circle.members_can_view_members !== false,
    ),
);

const allSelected = computed(
    () =>
        visibleCircles.value.length > 0 &&
        props.selectedIds.length === visibleCircles.value.length,
);

const sortedCircles = computed(() =>
    [...visibleCircles.value].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    ),
);

const summaryText = computed(() => {
    if (props.selectedIds.length === 0) return t('No circles selected');
    if (allSelected.value) return t('All circles');

    return t(':count selected', { count: String(props.selectedIds.length) });
});

function toggle(circleId: string) {
    if (props.selectedIds.includes(circleId)) {
        emit(
            'update:selectedIds',
            props.selectedIds.filter((id) => id !== circleId),
        );
    } else {
        emit('update:selectedIds', [...props.selectedIds, circleId]);
    }
}

function toggleAll() {
    if (allSelected.value) {
        emit('update:selectedIds', []);
    } else {
        emit(
            'update:selectedIds',
            visibleCircles.value.map((c) => c.id),
        );
    }
}
</script>

<template>
    <div>
        <div class="mb-3 flex items-center justify-between gap-2">
            <button
                type="button"
                class="flex items-center gap-1.5 font-semibold text-teal"
                @click="isCollapsed = !isCollapsed"
            >
                {{ t('Share with circles') }}
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

            <span v-if="isCollapsed" class="truncate text-teal-muted">{{
                summaryText
            }}</span>
            <button
                v-else-if="visibleCircles.length > 0"
                type="button"
                class="text-teal hover:text-teal-light"
                @click="toggleAll"
            >
                {{ allSelected ? t('Deselect all') : t('Select all') }}
            </button>
        </div>

        <div
            v-if="!isCollapsed"
            :class="
                layout === 'grid'
                    ? 'grid grid-cols-4 gap-x-3 gap-y-4'
                    : '-mx-1 no-scrollbar flex gap-3 overflow-x-auto px-1 pb-1'
            "
        >
            <button
                v-for="circle in sortedCircles"
                :key="circle.id"
                type="button"
                class="flex flex-col items-center gap-1.5"
                :class="layout === 'grid' ? '' : 'shrink-0'"
                @click="toggle(circle.id)"
            >
                <div
                    class="relative rounded-full p-[2px] transition-colors"
                    :class="
                        selectedIds.includes(circle.id)
                            ? 'circle-ring'
                            : 'bg-sand-200'
                    "
                >
                    <div class="rounded-full bg-white p-0.5">
                        <img
                            v-if="circle.photo"
                            :src="circle.photo"
                            :alt="circle.name"
                            class="size-14 rounded-full object-cover transition-opacity"
                            :class="
                                selectedIds.includes(circle.id)
                                    ? ''
                                    : 'opacity-60'
                            "
                        />
                        <div
                            v-else
                            class="flex size-14 items-center justify-center rounded-full bg-sand-100 transition-opacity"
                            :class="
                                selectedIds.includes(circle.id)
                                    ? ''
                                    : 'opacity-60'
                            "
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-7 bg-teal"
                                :style="iconMaskStyle(userIcon)"
                            ></span>
                        </div>
                    </div>

                    <div
                        v-if="selectedIds.includes(circle.id)"
                        class="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full bg-teal ring-2 ring-white"
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
                        selectedIds.includes(circle.id)
                            ? 'font-medium text-teal'
                            : 'text-teal-muted'
                    "
                >
                    {{ circle.name }}
                </span>
            </button>
        </div>

        <p v-if="error" class="mt-2 text-blush-500">{{ error }}</p>
    </div>
</template>

<style scoped>
.circle-ring {
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
</style>
