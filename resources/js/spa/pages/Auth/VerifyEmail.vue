<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import LanguageSelector from '@/spa/components/LanguageSelector.vue';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import { useAuthStore } from '@/spa/stores/auth';
import mailIcon from '../../../../svg/doodle-icons/mail-open.svg';
import innerrLogo from '../../../../svg/innerr-logo-on-blue.svg';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

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
const router = useRouter();

const email = computed(() => auth.user?.email ?? '');
const flashError = ref<string | null>(null);
const resendMessage = ref<string | null>(null);
const resending = ref(false);
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

const form = useApiForm({ code: '' });

function onlyDigits(value: string): string {
    return value.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

function onCodeInput(event: Event): void {
    form.data.code = onlyDigits((event.target as HTMLInputElement).value);
}

function startCooldown(seconds: number): void {
    cooldown.value = seconds;
    clearInterval(timer);
    timer = setInterval(() => {
        cooldown.value -= 1;

        if (cooldown.value <= 0) {
            cooldown.value = 0;
            clearInterval(timer);
        }
    }, 1000);
}

onBeforeUnmount(() => clearInterval(timer));

async function submit(): Promise<void> {
    flashError.value = null;

    try {
        await form.post('/api/spa/auth/email/verify', {
            onSuccess: async (data) => {
                auth.user = (data as { user: typeof auth.user }).user;
                await router.replace('/');
            },
        });
    } catch (error) {
        if (error instanceof ApiError) {
            // 422 field errors are surfaced via form.errors.code; anything else
            // is a connection or server problem.
            if (error.status !== 422) {
                flashError.value = error.message || t('Could not verify email');
            }
        } else {
            flashError.value = t('Could not connect to the server');
        }
    }
}

async function resend(): Promise<void> {
    if (cooldown.value > 0 || resending.value) {
        return;
    }

    flashError.value = null;
    resendMessage.value = null;
    resending.value = true;

    try {
        await auth.resendEmailVerification();
        resendMessage.value = t('A new code has been sent to your email');
        startCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
            startCooldown(error.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
            resendMessage.value = t(
                'Please wait before requesting another code',
            );
        } else {
            flashError.value = t('Could not resend verification code');
        }
    } finally {
        resending.value = false;
    }
}

async function useDifferentAccount(): Promise<void> {
    await auth.logout();
    await router.replace({ name: 'spa.login' });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative isolate flex min-h-dvh flex-col overflow-hidden bg-brand-blue px-6 text-brand-sand"
    >
        <div class="relative flex items-center justify-end pt-4">
            <LanguageSelector />
        </div>

        <div
            class="relative flex flex-1 flex-col items-center justify-center py-6"
        >
            <div class="mb-8 text-center">
                <img
                    :src="innerrLogo"
                    alt="innerr"
                    class="mx-auto h-14 w-auto"
                />
                <span
                    aria-hidden="true"
                    class="mt-6 inline-block size-12 bg-brand-yellow"
                    :style="iconMaskStyle(mailIcon)"
                ></span>
                <h1 class="mt-4 text-2xl font-semibold text-brand-sand">
                    {{ t('Verify your email') }}
                </h1>
                <p class="mx-auto mt-3 max-w-xs text-brand-sand/85">
                    {{ t('We sent a 6-digit code to') }}
                    <span class="font-semibold text-brand-yellow">{{
                        email
                    }}</span
                    >. {{ t('Enter it below to continue.') }}
                </p>
            </div>

            <div class="relative w-full max-w-xs space-y-4">
                <p
                    v-if="flashError"
                    class="rounded-xl bg-destructive-soft px-3 py-2 text-center text-destructive-ink"
                >
                    {{ flashError }}
                </p>

                <form class="space-y-4" @submit.prevent="submit">
                    <input
                        :value="form.data.code"
                        type="text"
                        name="one-time-code"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        :maxlength="CODE_LENGTH"
                        :aria-label="t('Verification code')"
                        class="w-full rounded-2xl bg-brand-sand/10 py-4 text-center text-3xl font-semibold tracking-[0.5em] text-brand-sand ring-1 ring-brand-sand/20 backdrop-blur-sm placeholder:tracking-normal placeholder:text-brand-sand/40 focus:ring-2 focus:ring-brand-yellow/50 focus:outline-none"
                        :class="
                            form.errors.code
                                ? 'ring-blush-400 focus:ring-blush-400/40'
                                : ''
                        "
                        placeholder="------"
                        @input="onCodeInput"
                    />
                    <p
                        v-if="form.errors.code"
                        class="px-1 text-center text-brand-yellow"
                    >
                        {{ form.errors.code }}
                    </p>

                    <Button
                        type="submit"
                        variant="inverse"
                        size="lg"
                        block
                        :loading="form.processing"
                        :disabled="form.data.code.length < CODE_LENGTH"
                    >
                        {{ t('Verify') }}
                    </Button>
                </form>

                <div class="text-center">
                    <p v-if="resendMessage" class="mb-2 text-brand-sand/80">
                        {{ resendMessage }}
                    </p>
                    <button
                        type="button"
                        class="text-brand-yellow transition hover:text-brand-yellow/80 disabled:cursor-not-allowed disabled:text-brand-sand/50"
                        :disabled="cooldown > 0 || resending"
                        @click="resend"
                    >
                        <template v-if="cooldown > 0">
                            {{
                                t('Resend code in :seconds s', {
                                    seconds: cooldown,
                                })
                            }}
                        </template>
                        <template v-else>
                            {{ t('Resend code') }}
                        </template>
                    </button>
                </div>
            </div>
        </div>

        <div class="relative pt-4 pb-8 text-center">
            <button
                type="button"
                class="text-brand-sand/70 underline-offset-4 transition hover:text-brand-sand hover:underline"
                @click="useDifferentAccount"
            >
                {{ t('Use a different account') }}
            </button>
        </div>
    </div>
</template>
