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

        <div class="relative flex justify-end pt-4">
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
                    <img
                        :src="innerrLogo"
                        alt="innerr"
                        class="mx-auto h-16 w-auto"
                    />
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

                        <RouterLink
                            :to="{ name: 'spa.forgot-password' }"
                            class="block text-center text-brand-sand/80 underline decoration-brand-yellow/60 decoration-wavy decoration-2 underline-offset-4 hover:text-brand-yellow"
                        >
                            {{ t('Forgot password?') }}
                        </RouterLink>
                    </form>

                    <button
                        v-else
                        type="button"
                        class="group flex w-full items-center justify-center gap-1.5 pt-1 text-center text-brand-yellow transition hover:text-brand-yellow/80"
                        @click="showEmailForm = true"
                    >
                        <span>{{ t('Log in with email') }}</span>
                        <span
                            class="transition-transform group-hover:translate-x-0.5"
                            >→</span
                        >
                    </button>
                </div>
            </div>
        </div>

        <div class="relative pt-4 pb-8">
            <p class="text-center text-brand-sand/80">
                {{ t('New to innerr?') }}
                <RouterLink
                    :to="{ name: 'spa.register' }"
                    class="font-semibold text-brand-yellow decoration-brand-yellow/60 decoration-wavy decoration-2 underline-offset-4 hover:underline"
                >
                    {{ t('Create an account') }}
                </RouterLink>
            </p>
        </div>
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
