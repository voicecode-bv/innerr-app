<script setup lang="ts">
import BottomSheet from '@/components/BottomSheet.vue';
import { useFeedLayout } from '@/spa/composables/useFeedLayout';
import { useTranslations } from '@/spa/composables/useTranslations';
import type { FeedLayout } from '@/spa/stores/auth';

defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'chosen', layout: FeedLayout): void;
}>();

const { t } = useTranslations();
const { setLayout } = useFeedLayout();

function choose(layout: FeedLayout): void {
    void setLayout(layout);
    emit('chosen', layout);
    emit('update:open', false);
}
</script>

<template>
    <BottomSheet :open="open" @update:open="emit('update:open', $event)">
        <div
            class="px-4 pt-2 pb-[calc(theme(spacing.24)+env(safe-area-inset-bottom))]"
        >
            <h2 class="text-center font-display text-xl font-semibold text-ink">
                {{ t('How do you want to see your feed?') }}
            </h2>
            <p class="mt-1 text-center text-ink-muted">
                {{ t('You can change this anytime in your profile.') }}
            </p>

            <div class="mt-5 grid grid-cols-2 gap-3">
                <button
                    type="button"
                    class="flex flex-col items-center gap-3 rounded-2xl border-2 border-sand-200 bg-surface p-3 text-center transition-colors active:border-action"
                    @click="choose('masonry')"
                >
                    <span
                        aria-hidden="true"
                        class="flex aspect-square w-full items-stretch gap-1.5 rounded-xl bg-sand-100/70 p-2.5"
                    >
                        <span class="flex flex-1 flex-col gap-1.5">
                            <span
                                class="block h-10 rounded-md bg-accent-soft"
                            />
                            <span class="block h-7 rounded-md bg-sage-200" />
                            <span
                                class="block h-9 rounded-md bg-brand-yellow/60"
                            />
                        </span>
                        <span class="flex flex-1 flex-col gap-1.5">
                            <span class="block h-7 rounded-md bg-sage-200" />
                            <span
                                class="block h-10 rounded-md bg-brand-blue/40"
                            />
                            <span class="block h-6 rounded-md bg-accent-soft" />
                        </span>
                    </span>
                    <span class="flex flex-col gap-0.5">
                        <span class="font-semibold text-ink">{{
                            t('Grid')
                        }}</span>
                        <span class="text-sm text-ink-muted">{{
                            t('A staggered photo wall')
                        }}</span>
                    </span>
                </button>

                <button
                    type="button"
                    class="flex flex-col items-center gap-3 rounded-2xl border-2 border-sand-200 bg-surface p-3 text-center transition-colors active:border-action"
                    @click="choose('list')"
                >
                    <span
                        aria-hidden="true"
                        class="flex aspect-square w-full flex-col gap-2 rounded-xl bg-sand-100/70 p-2.5"
                    >
                        <span
                            class="flex flex-col gap-1 rounded-md bg-surface p-1.5 shadow-sm"
                        >
                            <span
                                class="block h-1.5 w-1/2 rounded bg-sand-200"
                            />
                            <span class="block h-8 rounded bg-accent-soft" />
                        </span>
                        <span
                            class="flex flex-col gap-1 rounded-md bg-surface p-1.5 shadow-sm"
                        >
                            <span
                                class="block h-1.5 w-1/3 rounded bg-sand-200"
                            />
                            <span class="block h-8 rounded bg-sage-200" />
                        </span>
                    </span>
                    <span class="flex flex-col gap-0.5">
                        <span class="font-semibold text-ink">{{
                            t('Classic')
                        }}</span>
                        <span class="text-sm text-ink-muted">{{
                            t('One post at a time')
                        }}</span>
                    </span>
                </button>
            </div>
        </div>
    </BottomSheet>
</template>
