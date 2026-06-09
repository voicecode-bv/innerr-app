<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import AppleAuthButton from '@/spa/components/auth/AppleAuthButton.vue';
import GoogleAuthButton from '@/spa/components/auth/GoogleAuthButton.vue';
import LanguageSelector from '@/spa/components/LanguageSelector.vue';
import TextField from '@/spa/components/TextField.vue';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useInviteRedeem } from '@/spa/composables/useInviteRedeem';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import { useAuthStore } from '@/spa/stores/auth';
import handIcon from '../../../../svg/doodle-icons/hand.svg';
import keyIcon from '../../../../svg/doodle-icons/key.svg';
import mailIcon from '../../../../svg/doodle-icons/mail.svg';
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
const router = useRouter();
const route = useRoute();
const { redirectAfterAuth } = useInviteRedeem();

const socialAuthUrls = computed(() => auth.socialAuthUrls);

const flashError = ref<string | null>(null);

const oauthErrorMessages: Record<string, string> = {
    missing_email: 'Social sign-in failed: missing email',
    missing_token: 'Social sign-in failed',
    invalid_token: 'Social sign-in failed',
};

onMounted(() => {
    const code = route.query.oauth_error;

    if (typeof code === 'string' && code !== '') {
        const messageKey = oauthErrorMessages[code] ?? 'Social sign-in failed';
        flashError.value = t(messageKey);
        router.replace({ query: { ...route.query, oauth_error: undefined } });
    }
});

const form = useApiForm({
    email: '',
    password: '',
});

const showEmailForm = ref(false);

// Verborgen gebaar: tik 10× op het innerr-logo om de (publieke) debugpagina te
// openen. Bedoeld om token/secure-storage problemen te kunnen onderzoeken,
// óók wanneer de gebruiker ogenschijnlijk uitgelogd is. De teller reset zodra
// er even niet getikt wordt, zodat losse tikken niets doen.
const LOGO_TAPS_REQUIRED = 10;
const LOGO_TAP_RESET_MS = 1500;

let logoTapCount = 0;
let logoTapResetTimer: ReturnType<typeof setTimeout> | null = null;

function handleLogoTap(): void {
    logoTapCount += 1;

    if (logoTapResetTimer) {
        clearTimeout(logoTapResetTimer);
        logoTapResetTimer = null;
    }

    if (logoTapCount >= LOGO_TAPS_REQUIRED) {
        logoTapCount = 0;
        router.push({ name: 'spa.dev.debug' });

        return;
    }

    logoTapResetTimer = setTimeout(() => {
        logoTapCount = 0;
        logoTapResetTimer = null;
    }, LOGO_TAP_RESET_MS);
}

async function submit(): Promise<void> {
    flashError.value = null;

    try {
        await form.post<{ user: unknown; token: string; redirect_to: string }>(
            '/api/spa/auth/login',
            {
                onSuccess: async (data) => {
                    await auth.bootstrap();
                    await redirectAfterAuth(data.redirect_to ?? '/');
                },
                onFinish: () => form.reset('password'),
            },
        );
    } catch (error) {
        if (error instanceof ApiError) {
            flashError.value = error.message || t('Invalid credentials');
        } else {
            flashError.value = t('Could not connect to the server');
        }
    }
}
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
                class="doodle doodle-3 absolute top-1/2 right-6 size-14 text-brand-yellow/50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            >
                <path d="M3 12 Q 7 6, 11 12 T 19 12" />
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

        <div class="relative flex items-center justify-between pt-4">
            <RouterLink
                :to="{ name: 'spa.welcome' }"
                class="inline-flex items-center gap-1 rounded-full bg-brand-sand/15 px-3 py-2 text-brand-sand shadow-sm backdrop-blur-sm transition hover:-translate-x-0.5 hover:bg-brand-sand/25"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                    class="size-4"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
                {{ t('Back') }}
            </RouterLink>
            <LanguageSelector />
        </div>

        <div class="relative flex flex-1 flex-col items-center justify-center">
            <div class="mb-8 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-3 py-1 text-sm font-medium text-brand-blue shadow-sm"
                >
                    {{ t('welcome back') }}
                    <span
                        aria-hidden="true"
                        class="inline-block size-4 origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite] bg-current"
                        :style="iconMaskStyle(handIcon)"
                    ></span>
                </span>
                <h1 class="mt-4">
                    <button
                        type="button"
                        class="mx-auto block"
                        aria-label="innerr"
                        @click="handleLogoTap"
                    >
                        <img
                            :src="innerrLogo"
                            alt="innerr"
                            class="mx-auto h-16 w-auto"
                        />
                    </button>
                </h1>
                <p class="mt-3 text-base font-medium text-brand-sand/85">
                    {{ t('Safely share with those who matter') }}
                </p>
            </div>

            <div class="relative w-full max-w-xs">
                <div class="space-y-3">
                    <p
                        v-if="flashError"
                        class="rounded-xl bg-destructive-soft px-3 py-2 text-center text-destructive-ink"
                    >
                        {{ flashError }}
                    </p>

                    <template v-if="!showEmailForm">
                        <AppleAuthButton
                            :url="socialAuthUrls.apple"
                            :label="t('Continue with Apple')"
                        />
                        <GoogleAuthButton
                            :url="socialAuthUrls.google"
                            :label="t('Continue with Google')"
                        />

                        <div class="flex items-center gap-3 pt-1">
                            <span class="h-px flex-1 bg-brand-sand/30"></span>
                            <span
                                class="tracking-widest text-brand-sand/60 uppercase"
                                >{{ t('or') }}</span
                            >
                            <span class="h-px flex-1 bg-brand-sand/30"></span>
                        </div>
                    </template>

                    <button
                        v-if="showEmailForm"
                        type="button"
                        class="group -ml-1 inline-flex items-center gap-1 rounded-full py-1 text-brand-yellow transition hover:text-brand-yellow/80"
                        @click="showEmailForm = false"
                    >
                        <span
                            class="transition-transform group-hover:-translate-x-0.5"
                            >←</span
                        >
                        <span>{{ t('Back') }}</span>
                    </button>

                    <form
                        v-if="showEmailForm"
                        class="space-y-3 pt-1"
                        @submit.prevent="submit"
                    >
                        <TextField
                            v-model="form.data.email"
                            type="email"
                            name="email"
                            :placeholder="t('Email address')"
                            autocomplete="email"
                            :error="form.errors.email"
                        />

                        <TextField
                            v-model="form.data.password"
                            type="password"
                            name="password"
                            :placeholder="t('Password')"
                            autocomplete="current-password"
                            :error="form.errors.password"
                        />

                        <Button
                            type="submit"
                            variant="inverse"
                            size="lg"
                            block
                            :disabled="
                                form.processing ||
                                !form.data.email ||
                                !form.data.password
                            "
                        >
                            {{ form.processing ? '...' : t('Log in') }}
                        </Button>

                        <div class="pt-4">
                            <RouterLink
                                :to="{ name: 'spa.forgot-password' }"
                                class="flex w-full items-center justify-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-brand-blue shadow-sm transition hover:-translate-y-0.5 hover:bg-white/90"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-5 bg-current"
                                    :style="iconMaskStyle(keyIcon)"
                                ></span>
                                {{ t('Forgot password?') }}
                            </RouterLink>
                        </div>
                    </form>

                    <button
                        v-else
                        type="button"
                        class="flex w-full items-center justify-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-brand-blue shadow-sm transition hover:-translate-y-0.5 hover:bg-white/90"
                        @click="showEmailForm = true"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-5 bg-current"
                            :style="iconMaskStyle(mailIcon)"
                        ></span>
                        <span>{{ t('Log in with email') }}</span>
                    </button>
                </div>
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
.doodle-3 {
    animation-delay: 2.4s;
    animation-duration: 7s;
}
.doodle-4 {
    animation-delay: 0.6s;
    animation-duration: 6.5s;
}
</style>
