<script setup lang="ts">
import Button from '@/components/Button.vue';
import LanguageSelector from '@/spa/components/LanguageSelector.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAuthStore } from '@/spa/stores/auth';
import handIcon from '../../../../svg/doodle-icons/hand.svg';
import innerrLogo from '../../../../svg/innerr-logo-on-blue.svg';

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

const { t } = useTranslations();
const auth = useAuthStore();
</script>

<template>
    <div
        class="nativephp-safe-area relative isolate flex h-dvh flex-col overflow-hidden bg-brand-blue px-6"
    >
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 -z-10"
        >
            <svg
                class="doodle doodle-1 absolute top-28 left-8 size-12 text-brand-yellow/65"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="12" cy="12" r="4" />
                <path
                    d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                />
            </svg>
            <svg
                class="doodle doodle-2 absolute top-20 right-10 size-10 text-brand-sand/40"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <circle cx="12" cy="12" r="6" />
            </svg>
            <svg
                class="doodle doodle-4 absolute bottom-32 left-6 size-12 text-brand-yellow/65"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"
                />
            </svg>
            <svg
                class="doodle doodle-1 absolute right-12 bottom-24 size-12 text-brand-sand/35"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="12" cy="12" r="9" />
                <path d="M8 14.5c1 1.5 2.5 2.2 4 2.2s3-.7 4-2.2" />
                <circle
                    cx="9"
                    cy="10"
                    r="1"
                    fill="currentColor"
                    stroke="none"
                />
                <circle
                    cx="15"
                    cy="10"
                    r="1"
                    fill="currentColor"
                    stroke="none"
                />
            </svg>
        </div>

        <div class="relative flex justify-end pt-4">
            <LanguageSelector />
        </div>

        <div class="relative flex flex-1 flex-col items-center justify-center">
            <div class="mb-10 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-3 py-1 text-sm font-medium text-brand-blue shadow-sm"
                >
                    {{ t('welcome') }}
                    <span
                        aria-hidden="true"
                        class="inline-block size-4 origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite] bg-current"
                        :style="iconMaskStyle(handIcon)"
                    ></span>
                </span>
                <h1 class="mt-4">
                    <img
                        :src="innerrLogo"
                        alt="innerr"
                        class="mx-auto h-16 w-auto"
                    />
                </h1>
                <p class="mt-3 text-base font-medium text-brand-sand/85">
                    {{ t('The private album for your family') }}
                </p>
            </div>

            <div class="w-full max-w-xs space-y-3">
                <Button
                    :to="{ name: 'spa.register' }"
                    variant="inverse"
                    size="lg"
                    block
                >
                    {{ t('Create an account') }}
                </Button>

                <Button
                    :to="{ name: 'spa.login' }"
                    variant="secondary"
                    size="lg"
                    block
                >
                    {{ t('I already have an account') }}
                </Button>
            </div>
        </div>

        <p
            v-if="auth.appVersion"
            class="relative pb-4 text-center text-xs text-brand-sand/50"
        >
            {{ t('Version :version', { version: auth.appVersion }) }}
        </p>
    </div>
</template>

<style scoped>
.doodle-1 {
    animation-delay: 0s;
}
.doodle-2 {
    animation-delay: 1.2s;
    animation-duration: 5s;
}
.doodle-4 {
    animation-delay: 0.6s;
    animation-duration: 6.5s;
}
</style>
