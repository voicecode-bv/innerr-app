<script setup lang="ts">
import { Browser } from '@nativephp/mobile';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import foldedHandsIcon from '../../../../svg/doodle-icons/folded-hands.svg';
import heartFilledIcon from '../../../../svg/doodle-icons/heart-filled.svg';

const DONATION_PERCENTAGE = 10;

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

function goBack(): void {
    router.push({ name: 'spa.home' });
}
</script>

<template>
    <AppLayout :title="t('Inner Gives')">
        <template #header-left>
            <button class="flex items-center text-ink" @click="goBack">
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
            class="relative mt-10 min-h-full pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))]"
        >
            <div class="relative space-y-4 px-4 pt-4 pb-6">
                <div
                    data-tour="give.hero"
                    class="reveal-item rounded-lg bg-action p-6 shadow-sm shadow-action/20"
                >
                    <div class="flex flex-col items-center gap-4 text-center">
                        <IconTile
                            :icon="foldedHandsIcon"
                            size="lg"
                            tone="yellow"
                        />
                        <h2
                            class="font-display text-2xl font-semibold text-brand-sand"
                        >
                            {{ t('Inner Gives') }}
                        </h2>
                        <p class="leading-relaxed text-brand-sand/80">
                            {{
                                t(
                                    "Children who are sick, going through surgery, recovering. Innerr donates 10% of every paid subscription to a Dutch foundation for children's care.",
                                )
                            }}
                        </p>
                        <Button
                            type="button"
                            variant="inverse"
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
                </div>

                <div
                    class="reveal-item flex flex-col items-center gap-4 rounded-lg bg-brand-green p-6 text-center shadow-sm shadow-sage-900/20"
                >
                    <IconTile :icon="heartFilledIcon" size="lg" tone="yellow" />
                    <p
                        class="font-display text-6xl leading-none font-semibold text-brand-yellow"
                    >
                        {{ DONATION_PERCENTAGE }}<span class="text-4xl">%</span>
                    </p>
                    <p class="font-sans text-xl font-semibold text-brand-sand">
                        {{ t('A bright smile') }}
                    </p>
                    <p class="leading-relaxed text-brand-sand/90">
                        {{
                            t(
                                '10% of your subscription brings extra joy to recovering kids.',
                            )
                        }}
                    </p>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
