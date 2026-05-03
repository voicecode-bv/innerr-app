<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import Confetti from '@/components/Confetti.vue';
import IconTile from '@/components/IconTile.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi, ApiError } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useToastsStore } from '@/spa/stores/toasts';
import foldedHandsIcon from '../../../../svg/doodle-icons/folded-hands.svg';
import heartIcon from '../../../../svg/doodle-icons/heart.svg';

interface EditableProfile {
    id: number;
    donation_percentage: number;
}

const OPTIONS: number[] = [0, 1, 2, 5, 10];

const { t } = useTranslations();
const router = useRouter();
const toasts = useToastsStore();

const isLoading = ref(true);
const processing = ref(false);
const savedPercentage = ref<number | null>(null);
const selected = ref<number>(0);
const showConfetti = ref(false);

const hasChanged = computed(() => savedPercentage.value !== null && selected.value !== savedPercentage.value);
const isContributing = computed(() => savedPercentage.value !== null && savedPercentage.value > 0);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

async function loadProfile(): Promise<void> {
    try {
        const response = await externalApi.get<{ data: EditableProfile }>('/profile');
        const value = response.data.donation_percentage ?? 0;
        savedPercentage.value = value;
        selected.value = value;
    } catch {
        savedPercentage.value = 0;
        selected.value = 0;
    } finally {
        isLoading.value = false;
    }
}

onMounted(loadProfile);

function selectOption(value: number): void {
    if (processing.value) {
return;
}

    selected.value = value;
}

async function save(): Promise<void> {
    if (processing.value || !hasChanged.value) {
return;
}

    processing.value = true;

    const next = selected.value;
    const previous = savedPercentage.value ?? 0;

    try {
        await externalApi.patch('/profile', { donation_percentage: next });
        savedPercentage.value = next;

        if (next > 0) {
            toasts.success(t('Thank you! We will donate :percentage% on your behalf.', { percentage: next }));

            if (previous === 0) {
                triggerConfetti();
            }
        } else {
            toasts.success(t('Your preference has been saved.'));
        }
    } catch (error) {
        const message = error instanceof ApiError && error.message
            ? error.message
            : t('Could not save your preference. Please try again.');
        toasts.error(message);
    } finally {
        processing.value = false;
    }
}

function triggerConfetti(): void {
    showConfetti.value = false;
    nextTick(() => {
        showConfetti.value = true;
    });
}
</script>

<template>
    <AppLayout :title="t('Inner Gives')">
        <Confetti :active="showConfetti" />

        <template #header-left>
            <button class="flex items-center text-teal dark:text-sand-300" @click="goBack">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
            </button>
        </template>

        <div class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]">
            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <SurfaceCard>
                    <div class="flex flex-col items-center gap-3 text-center">
                        <IconTile :icon="foldedHandsIcon" size="lg" tone="sage" />
                        <h2 class="font-display text-xl font-semibold text-teal dark:text-sand-100">
                            {{ t('Inner Gives') }}
                        </h2>
                        <p class="text-sm text-sand-600 dark:text-sand-400">
                            {{ t('Choose a percentage of your subscription that Innerr will donate to charity each month. You can change or pause this any time.') }}
                        </p>
                    </div>
                </SurfaceCard>

                <SurfaceCard v-if="isLoading">
                    <div class="space-y-3 animate-pulse">
                        <div v-for="n in OPTIONS.length" :key="n" class="h-14 rounded-lg bg-sand-200 dark:bg-sand-700/60" />
                    </div>
                </SurfaceCard>

                <SurfaceCard v-else>
                    <fieldset class="space-y-3">
                        <legend class="mb-3 text-xs font-medium uppercase tracking-wider text-sand-500 dark:text-sand-400">
                            {{ t('Donation percentage') }}
                        </legend>
                        <button
                            v-for="option in OPTIONS"
                            :key="option"
                            type="button"
                            role="radio"
                            :aria-checked="selected === option"
                            class="flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-4 text-left transition active:scale-[0.99]"
                            :class="selected === option
                                ? 'border-teal bg-sage-100/70 text-teal dark:border-sage-300 dark:bg-sage-900/40 dark:text-sand-100'
                                : 'border-sand-200 bg-white/60 text-sand-700 hover:border-sand-300 dark:border-sand-700/60 dark:bg-sand-800/60 dark:text-sand-200'"
                            @click="selectOption(option)"
                        >
                            <span class="flex items-center gap-3">
                                <span
                                    class="flex size-5 items-center justify-center rounded-full border-2 transition"
                                    :class="selected === option ? 'border-teal bg-teal dark:border-sand-100 dark:bg-sand-100' : 'border-sand-300 dark:border-sand-600'"
                                >
                                    <span
                                        v-if="selected === option"
                                        class="size-2 rounded-full bg-white dark:bg-teal"
                                    />
                                </span>
                                <span class="font-sans text-base font-semibold">
                                    {{ option === 0 ? t('No donation for now') : t(':percentage% of my subscription', { percentage: option }) }}
                                </span>
                            </span>
                        </button>
                    </fieldset>
                </SurfaceCard>

                <SurfaceCard v-if="isContributing" tone="muted">
                    <div class="flex items-start gap-3">
                        <IconTile :icon="heartIcon" size="sm" tone="accent" />
                        <div class="min-w-0 flex-1">
                            <p class="font-sans text-sm font-semibold text-teal dark:text-sand-100">
                                {{ t('Thank you for giving back') }}
                            </p>
                            <p class="mt-1 text-sm text-sand-600 dark:text-sand-400">
                                {{ t('Each month we donate :percentage% of your subscription on your behalf.', { percentage: savedPercentage ?? 0 }) }}
                            </p>
                        </div>
                    </div>
                </SurfaceCard>

                <div class="flex justify-end">
                    <Button type="button" size="md" :disabled="processing || isLoading || !hasChanged" @click="save">
                        {{ processing ? t('Saving...') : t('Save') }}
                    </Button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
