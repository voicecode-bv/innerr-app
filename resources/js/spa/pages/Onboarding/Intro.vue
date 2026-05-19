<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { trackOnboardingStep } from '@/spa/http/onboarding';
import cameraIcon from '../../../../svg/doodle-icons/camera.svg';
import heartIcon from '../../../../svg/doodle-icons/heart.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const router = useRouter();

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

const steps = [
    {
        icon: userIcon,
        title: t('Gather your circles'),
        description: t(
            'Create private circles for family and friends. Only people you invite can see what you share.',
        ),
    },
    {
        icon: cameraIcon,
        title: t('Share your moments'),
        description: t(
            'Post photos and videos to the circles that matter. No public feed, no strangers.',
        ),
    },
    {
        icon: heartIcon,
        title: t('Stay close'),
        description: t(
            'React with hearts, leave comments, and keep in touch. Calmly, privately, together.',
        ),
    },
];

function continueOnboarding(): void {
    trackOnboardingStep('intro');
    router.push({ name: 'spa.onboarding.birthdate' });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-ink"
    >
        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-10 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success-ink shadow-sm"
                >
                    {{ t('How it works') }}
                </span>
                <h1
                    class="mt-3 font-display text-4xl font-semibold tracking-tight text-ink"
                >
                    {{ t('Welcome to innerr') }}
                </h1>
                <p class="mt-3 text-ink-muted">
                    {{ t('Three simple steps and you are ready to share.') }}
                </p>
            </div>

            <ol class="mt-8 w-full max-w-sm space-y-4">
                <li
                    v-for="(step, index) in steps"
                    :key="index"
                    class="relative flex items-start gap-4 rounded-lg bg-surface/50 p-4 shadow-sm backdrop-blur-sm"
                >
                    <div class="relative shrink-0">
                        <div
                            class="flex size-14 items-center justify-center rounded-lg bg-success-soft text-ink"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-8 bg-current"
                                :style="iconMaskStyle(step.icon)"
                            ></span>
                        </div>
                        <span
                            class="absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full bg-accent leading-none font-semibold text-white shadow-md"
                        >
                            {{ index + 1 }}
                        </span>
                    </div>
                    <div class="flex-1 pt-1">
                        <h2 class="font-sans text-base font-semibold text-ink">
                            {{ step.title }}
                        </h2>
                        <p class="mt-1 leading-relaxed text-ink-muted">
                            {{ step.description }}
                        </p>
                    </div>
                </li>
            </ol>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="w-full rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover"
                @click="continueOnboarding"
            >
                {{ t('Continue') }}
            </button>
        </div>
    </div>
</template>
