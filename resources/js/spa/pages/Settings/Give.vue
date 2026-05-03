<script setup lang="ts">
import { Browser } from '@nativephp/mobile';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi, ApiError } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import balloonIcon from '../../../../svg/doodle-icons/balloon-2.svg';
import foldedHandsIcon from '../../../../svg/doodle-icons/folded-hands.svg';
import heartFilledIcon from '../../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../../svg/doodle-icons/heart.svg';

interface DonationOption {
    value: number;
    icon: string;
    labelKey: string;
    descriptionKey: string;
}

interface EditableProfile {
    id: number;
    donation_percentage: number;
}

const OPTIONS: DonationOption[] = [
    {
        value: 0,
        icon: foldedHandsIcon,
        labelKey: 'Not right now',
        descriptionKey:
            'It does not cost you anything extra, are you sure this is the option you want?',
    },
    {
        value: 5,
        icon: heartIcon,
        labelKey: 'A warm heart',
        descriptionKey:
            '5% of my subscription goes to children in care every month.',
    },
    {
        value: 10,
        icon: balloonIcon,
        labelKey: 'A bright smile',
        descriptionKey:
            '10% of my subscription brings extra joy to recovering kids.',
    },
];

const { t, locale } = useTranslations();
const router = useRouter();

const learnMoreUrl = computed(() =>
    locale.value === 'nl'
        ? 'https://innerr.app/nl/doneren/'
        : 'https://innerr.app/en/donate/',
);

async function openLearnMore(): Promise<void> {
    try {
        await Browser.open(learnMoreUrl.value);
    } catch {
        if (typeof window !== 'undefined') {
            window.open(learnMoreUrl.value, '_blank');
        }
    }
}

const isLoading = ref(true);
const savingValue = ref<number | null>(null);
const selected = ref<number>(0);
const errorMessage = ref<string | null>(null);

const isContributing = computed(() => selected.value > 0);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

async function loadProfile(): Promise<void> {
    try {
        const response = await externalApi.get<{ data: EditableProfile }>(
            '/profile',
        );
        selected.value = response.data.donation_percentage ?? 0;
    } catch {
        selected.value = 0;
    } finally {
        isLoading.value = false;
    }
}

onMounted(loadProfile);

async function selectOption(value: number): Promise<void> {
    if (savingValue.value !== null || value === selected.value) {
        return;
    }

    const previous = selected.value;
    selected.value = value;
    savingValue.value = value;
    errorMessage.value = null;

    try {
        await externalApi.patch('/profile', { donation_percentage: value });
    } catch (error) {
        selected.value = previous;
        errorMessage.value =
            error instanceof ApiError && error.message
                ? error.message
                : t('Could not save your preference. Please try again.');
    } finally {
        savingValue.value = null;
    }
}
</script>

<template>
    <AppLayout :title="t('Inner Gives')">
        <template #header-left>
            <button
                class="flex items-center text-teal dark:text-sand-300"
                @click="goBack"
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
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>
        </template>

        <div
            class="relative mt-10 min-h-full pb-[calc(theme(spacing.48)+env(safe-area-inset-bottom))]"
        >
            <div
                class="relative space-y-4 px-4 pt-4 pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]"
            >
                <SurfaceCard class="reveal-item">
                    <div class="flex flex-col items-center gap-4 text-center">
                        <IconTile
                            :icon="foldedHandsIcon"
                            size="lg"
                            tone="sage"
                        />
                        <h2
                            class="font-display text-2xl font-semibold text-teal dark:text-sand-100"
                        >
                            {{ t('Inner Gives') }}
                        </h2>
                        <p
                            class="leading-relaxed text-sand-600 dark:text-sand-300"
                        >
                            {{
                                t(
                                    "Children who are sick, going through surgery, recovering. Innerr gives part of every paid subscription back to a Dutch foundation for children's care. You choose how much.",
                                )
                            }}
                        </p>
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            @click="openLearnMore"
                        >
                            {{ t('Read more on innerr.app') }}
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
                                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                />
                            </svg>
                        </Button>
                    </div>
                </SurfaceCard>

                <div
                    v-if="isLoading"
                    class="reveal-item grid gap-3 sm:grid-cols-3"
                >
                    <div
                        v-for="n in OPTIONS.length"
                        :key="n"
                        class="h-44 animate-pulse rounded-2xl bg-sand-200 dark:bg-sand-700/60"
                    />
                </div>

                <fieldset v-else class="reveal-item">
                    <legend class="sr-only">
                        {{ t('Donation percentage') }}
                    </legend>
                    <div class="grid gap-3 sm:grid-cols-3">
                        <button
                            v-for="option in OPTIONS"
                            :key="option.value"
                            type="button"
                            role="radio"
                            :aria-checked="selected === option.value"
                            class="group relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 px-5 py-7 text-center transition-all duration-200 active:scale-[0.98] disabled:cursor-progress"
                            :class="
                                selected === option.value
                                    ? 'border-teal bg-gradient-to-br from-sage-100 via-cream to-sand-50 shadow-md shadow-teal/10 dark:border-sage-300 dark:from-sage-900/50 dark:via-sand-800/60 dark:to-sand-900'
                                    : 'border-sand-200/70 bg-white/60 hover:-translate-y-0.5 hover:border-sand-300 hover:shadow-sm dark:border-sand-700/50 dark:bg-sand-800/40'
                            "
                            :disabled="savingValue !== null"
                            @click="selectOption(option.value)"
                        >
                            <span
                                v-if="savingValue === option.value"
                                class="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-teal text-white shadow-sm"
                                aria-hidden="true"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    class="size-3.5 animate-spin"
                                >
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        stroke-width="3"
                                        stroke-linecap="round"
                                        stroke-dasharray="40 60"
                                    />
                                </svg>
                            </span>
                            <span
                                v-else-if="selected === option.value"
                                class="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-teal text-white shadow-sm"
                                aria-hidden="true"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="3"
                                    class="size-3.5"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="m5 13 4 4L19 7"
                                    />
                                </svg>
                            </span>

                            <IconTile
                                :icon="option.icon"
                                size="lg"
                                :tone="
                                    selected === option.value ? 'teal' : 'sage'
                                "
                                class="transition-transform group-hover:-rotate-3"
                            />

                            <div class="space-y-3">
                                <p
                                    class="font-display text-6xl leading-none font-semibold"
                                    :class="
                                        selected === option.value
                                            ? 'text-teal dark:text-sand-50'
                                            : 'text-sand-700 dark:text-sand-200'
                                    "
                                >
                                    {{ option.value
                                    }}<span class="text-4xl">%</span>
                                </p>
                                <p
                                    class="font-sans text-xl font-semibold"
                                    :class="
                                        selected === option.value
                                            ? 'text-teal dark:text-sand-100'
                                            : 'text-sand-800 dark:text-sand-100'
                                    "
                                >
                                    {{ t(option.labelKey) }}
                                </p>
                            </div>

                            <p
                                class="leading-relaxed text-sand-600 dark:text-sand-300"
                            >
                                {{ t(option.descriptionKey) }}
                            </p>
                        </button>
                    </div>
                </fieldset>

                <SurfaceCard
                    v-if="isContributing"
                    tone="muted"
                    class="reveal-item"
                >
                    <div class="flex items-start gap-4">
                        <IconTile
                            :icon="heartFilledIcon"
                            size="md"
                            tone="accent"
                        />
                        <div class="min-w-0 flex-1">
                            <p
                                class="font-sans font-semibold text-teal dark:text-sand-100"
                            >
                                {{ t('Thank you for giving back') }}
                            </p>
                            <p
                                class="mt-1 leading-relaxed text-sand-600 dark:text-sand-300"
                            >
                                {{
                                    t(
                                        "Each month we donate :percentage% of your subscription to children's care on your behalf.",
                                        { percentage: selected },
                                    )
                                }}
                            </p>
                        </div>
                    </div>
                </SurfaceCard>

                <p
                    v-if="errorMessage"
                    class="rounded-lg bg-blush-50 p-3 text-blush-700 dark:bg-blush-900/30 dark:text-blush-200"
                >
                    {{ errorMessage }}
                </p>
            </div>
        </div>
    </AppLayout>
</template>
