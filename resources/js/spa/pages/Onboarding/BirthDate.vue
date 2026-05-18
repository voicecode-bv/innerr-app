<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import { trackOnboardingStep } from '@/spa/http/onboarding';
import cakeIcon from '../../../../svg/doodle-icons/cake.svg';

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

const birthdate = ref('');
const error = ref<string | null>(null);
const processing = ref(false);

const todayIso = new Date().toISOString().slice(0, 10);

async function submit(): Promise<void> {
    if (!birthdate.value) {
        return;
    }

    error.value = null;
    processing.value = true;

    try {
        await externalApi.put('/profile', { birthdate: birthdate.value });
        trackOnboardingStep('birthdate');
        router.push({ name: 'spa.onboarding.first-circle' });
    } catch (err) {
        if (err instanceof ApiError && err.status === 422) {
            error.value =
                (err.errors?.birthdate as string[] | undefined)?.[0] ??
                err.message ??
                t('Please enter a valid date.');
        } else {
            error.value = t('Could not save your birthdate. Please try again.');
        }
    } finally {
        processing.value = false;
    }
}

function skip(): void {
    trackOnboardingStep('birthdate');
    router.push({ name: 'spa.onboarding.first-circle' });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-teal"
    >
        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-10 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1 text-xs font-medium text-sage-700 shadow-sm"
                >
                    {{ t('A little about you') }}
                </span>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-teal"
                >
                    {{ t('When were you born?') }}
                </h1>
                <p class="mt-3 mx-auto max-w-xs text-teal-muted">
                    {{
                        t(
                            'We use this to show your age in each photo and video, so you can revisit the moment exactly as it happened.',
                        )
                    }}
                </p>
            </div>

            <div class="w-full max-w-sm space-y-5">
                <div
                    class="relative rounded-lg bg-white/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <div class="flex items-start gap-4">
                        <div
                            class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-yellow text-brand-green"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-7 bg-current"
                                :style="iconMaskStyle(cakeIcon)"
                            ></span>
                        </div>
                        <div class="flex-1">
                            <label
                                for="onboarding-birthdate"
                                class="tracking-wider text-teal-muted uppercase"
                            >
                                {{ t('Birthdate') }}
                            </label>
                            <input
                                id="onboarding-birthdate"
                                v-model="birthdate"
                                type="date"
                                :max="todayIso"
                                autofocus
                                class="mt-1 w-full border-0 bg-transparent p-0 font-sans text-xl font-semibold text-teal placeholder-teal-muted/50 focus:ring-0 focus:outline-none"
                            />
                        </div>
                    </div>
                    <p v-if="error" class="mt-3 text-blush-500">
                        {{ error }}
                    </p>
                </div>

                <p class="text-center text-sm text-teal-muted">
                    {{
                        t(
                            'Only you see this. We never share your birthdate publicly.',
                        )
                    }}
                </p>
            </div>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="w-full rounded-lg bg-teal py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-teal-light disabled:opacity-40"
                :disabled="!birthdate || processing"
                @click="submit"
            >
                {{ processing ? t('Saving...') : t('Continue') }}
            </button>
            <button
                class="mt-3 w-full py-2 text-teal-muted"
                :disabled="processing"
                @click="skip"
            >
                {{ t('Skip for now') }}
            </button>
        </div>
    </div>
</template>
