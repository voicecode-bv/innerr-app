<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
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
    router.push({ name: 'spa.onboarding.first-circle' });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-warmwhite px-6 text-sand-900 dark:bg-sand-900 dark:text-sand-100"
    >
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div
                class="absolute -top-24 -left-24 size-72 rounded-full bg-sage-200/60 blur-3xl dark:bg-sage-700/20"
            ></div>
            <div
                class="absolute top-1/3 -right-28 size-80 rounded-full bg-accent-soft/40 blur-3xl dark:bg-accent/10"
            ></div>
            <div
                class="absolute -bottom-32 left-1/4 size-96 rounded-full bg-sand-200/50 blur-3xl dark:bg-sand-700/30"
            ></div>
        </div>

        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-10 text-center">
                <p class="tracking-widest text-accent uppercase">
                    {{ t('How it works') }}
                </p>
                <h1
                    class="mt-3 font-display text-4xl font-semibold tracking-tight text-teal"
                >
                    {{ t('Welcome to innerr') }}
                </h1>
                <p class="mt-3 text-sand-600 dark:text-sand-400">
                    {{ t('Three simple steps and you are ready to share.') }}
                </p>
            </div>

            <ol class="mt-8 w-full max-w-sm space-y-4">
                <li
                    v-for="(step, index) in steps"
                    :key="index"
                    class="relative flex items-start gap-4 rounded-lg bg-white/50 p-4 shadow-sm backdrop-blur-sm dark:border-sand-700/50 dark:bg-sand-800/60"
                >
                    <div class="relative shrink-0">
                        <div
                            class="flex size-14 items-center justify-center rounded-lg bg-sage-100 text-teal dark:bg-sage-900/40"
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
                        <h2
                            class="font-sans text-base font-semibold text-sand-800 dark:text-sand-100"
                        >
                            {{ step.title }}
                        </h2>
                        <p
                            class="mt-1 leading-relaxed text-sand-600 dark:text-sand-400"
                        >
                            {{ step.description }}
                        </p>
                    </div>
                </li>
            </ol>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="w-full rounded-lg bg-teal py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-teal-light"
                @click="continueOnboarding"
            >
                {{ t('Continue') }}
            </button>
        </div>
    </div>
</template>
