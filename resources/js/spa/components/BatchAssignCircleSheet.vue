<script setup lang="ts">
import { ref, watch } from 'vue';
import BottomSheet from '@/components/BottomSheet.vue';
import Button from '@/components/Button.vue';
import CirclePicker from '@/components/CirclePicker.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import SheetHeader from '@/components/SheetHeader.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useCirclesStore } from '@/spa/stores/circles';

const props = defineProps<{
    open: boolean;
    /** Number of selected photos, shown in the header and confirm button. */
    postCount: number;
    /** The assignment request is in flight. */
    submitting: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'confirm', circleIds: string[]): void;
}>();

const { t } = useTranslations();
const circlesStore = useCirclesStore();

const isLoading = ref(false);
const loadError = ref<string | null>(null);
const selectedCircleIds = ref<string[]>([]);

async function loadCircles(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
        await circlesStore.ensureLoaded();
    } catch {
        loadError.value = t('Could not load circles');
    } finally {
        isLoading.value = false;
    }
}

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) {
            return;
        }

        selectedCircleIds.value = [];
        void loadCircles();
    },
    { immediate: true },
);

function close(): void {
    if (props.submitting) {
        return;
    }

    emit('update:open', false);
}

function onSheetUpdate(value: boolean): void {
    if (!value) {
        close();
    } else {
        emit('update:open', true);
    }
}

function confirm(): void {
    if (selectedCircleIds.value.length === 0 || props.submitting) {
        return;
    }

    emit('confirm', [...selectedCircleIds.value]);
}
</script>

<template>
    <BottomSheet :open="open" @update:open="onSheetUpdate">
        <template #header>
            <SheetHeader
                :title="t('Add to circle')"
                :count="postCount"
                @close="close"
            />
        </template>

        <div
            v-if="isLoading && (circlesStore.items?.length ?? 0) === 0"
            class="flex items-center justify-center px-4 py-10"
        >
            <LoadingSpinner />
        </div>

        <div v-else-if="loadError" class="px-4 py-10 text-center">
            <p class="text-destructive-ink">{{ loadError }}</p>
            <button class="mt-2 text-ink-muted" @click="loadCircles()">
                {{ t('Try again') }}
            </button>
        </div>

        <div
            v-else-if="(circlesStore.items?.length ?? 0) === 0"
            class="px-4 py-10 text-center"
        >
            <p class="text-ink-muted">
                {{ t('No circles available') }}
            </p>
        </div>

        <div
            v-else
            class="px-4 pb-[calc(theme(spacing.4)+env(safe-area-inset-bottom))]"
        >
            <CirclePicker
                :circles="circlesStore.items ?? []"
                :selected-ids="selectedCircleIds"
                :collapsible="false"
                layout="grid"
                :title="t('Choose circles')"
                @update:selected-ids="selectedCircleIds = $event"
            />

            <div class="mt-6">
                <Button
                    variant="primary"
                    size="lg"
                    block
                    :disabled="selectedCircleIds.length === 0 || submitting"
                    @click="confirm"
                >
                    <svg
                        v-if="submitting"
                        class="size-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                        />
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span v-else>
                        {{
                            postCount === 1
                                ? t('Add :count photo', { count: postCount })
                                : t('Add :count photos', { count: postCount })
                        }}
                    </span>
                </Button>
            </div>
        </div>
    </BottomSheet>
</template>
