<script setup lang="ts">
import { computed } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import userIcon from '../../../svg/doodle-icons/user.svg';

export interface ParentCandidate {
    userId: string;
    name: string;
    avatar: string | null;
}

/* Parent selection in the same visual language as CirclePicker: tappable
   avatar chips with the conic ring + check badge when selected. Candidates
   are the account-holding members of the child's circles; locked ids (the
   creator) render selected but cannot be toggled off. */
const props = withDefaults(
    defineProps<{
        candidates: ParentCandidate[];
        selectedIds: string[];
        lockedIds?: string[];
        error?: string | null;
    }>(),
    {
        lockedIds: () => [],
        error: null,
    },
);

const emit = defineEmits<{
    (e: 'update:selectedIds', value: string[]): void;
}>();

const { t } = useTranslations();

// Alphabetical, mirroring CirclePicker, so co-parents are easy to find.
const sortedCandidates = computed(() =>
    [...props.candidates].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    ),
);

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

function isSelected(userId: string): boolean {
    return (
        props.lockedIds.includes(userId) || props.selectedIds.includes(userId)
    );
}

function toggle(userId: string): void {
    if (props.lockedIds.includes(userId)) {
        return;
    }

    if (props.selectedIds.includes(userId)) {
        emit(
            'update:selectedIds',
            props.selectedIds.filter((id) => id !== userId),
        );
    } else {
        emit('update:selectedIds', [...props.selectedIds, userId]);
    }
}
</script>

<template>
    <div>
        <p class="font-semibold text-ink">{{ t('Parents') }}</p>
        <p class="mt-1 mb-3 text-sm text-ink-muted">
            {{
                t(
                    "Parents can edit this child's details and add it to their own circles.",
                )
            }}
        </p>

        <div
            v-if="candidates.length > 0"
            class="-mx-1 no-scrollbar flex gap-3 overflow-x-auto px-1 pb-1"
        >
            <button
                v-for="candidate in sortedCandidates"
                :key="candidate.userId"
                type="button"
                class="flex shrink-0 flex-col items-center gap-1.5"
                :class="
                    lockedIds.includes(candidate.userId) ? 'cursor-default' : ''
                "
                role="checkbox"
                :aria-checked="isSelected(candidate.userId)"
                :aria-disabled="lockedIds.includes(candidate.userId)"
                @click="toggle(candidate.userId)"
            >
                <div
                    class="relative rounded-full p-[2px] transition-colors"
                    :class="
                        isSelected(candidate.userId)
                            ? 'parent-ring'
                            : 'bg-sand-200'
                    "
                >
                    <div class="rounded-full bg-surface p-0.5">
                        <img
                            v-if="candidate.avatar"
                            :src="candidate.avatar"
                            :alt="candidate.name"
                            class="size-14 rounded-full object-cover transition-opacity"
                            :class="
                                isSelected(candidate.userId) ? '' : 'opacity-60'
                            "
                        />
                        <div
                            v-else
                            class="flex size-14 items-center justify-center rounded-full bg-sand-100 transition-opacity dark:bg-brand-blue"
                            :class="
                                isSelected(candidate.userId) ? '' : 'opacity-60'
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
                        v-if="isSelected(candidate.userId)"
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
                        isSelected(candidate.userId)
                            ? 'font-medium text-ink'
                            : 'text-ink-muted'
                    "
                >
                    {{ candidate.name }}
                </span>
            </button>
        </div>

        <p v-else class="text-sm text-ink-muted">
            {{ t('Members of the selected circles can become parents.') }}
        </p>

        <p v-if="error" class="mt-2 text-destructive-ink">{{ error }}</p>
    </div>
</template>

<style scoped>
.parent-ring {
    background: conic-gradient(
        from 0deg,
        var(--color-accent),
        var(--color-accent-soft),
        var(--color-sage-400),
        var(--color-teal-muted),
        var(--color-accent)
    );
}
</style>
