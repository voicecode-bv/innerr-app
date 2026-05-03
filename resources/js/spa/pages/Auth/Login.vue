<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppleAuthButton from '@/spa/components/auth/AppleAuthButton.vue';
import GoogleAuthButton from '@/spa/components/auth/GoogleAuthButton.vue';
import Button from '@/components/Button.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useAuthStore } from '@/spa/stores/auth';
import { useI18nStore } from '@/spa/stores/i18n';
import { ApiError } from '@/spa/http/apiClient';
import handIcon from '../../../../svg/doodle-icons/hand.svg';
import innerrLogo from '../../../../svg/innerr-logo.svg';

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
const i18n = useI18nStore();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const currentLocale = computed(() => i18n.locale);
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

function setLocale(locale: string): void {
    i18n.set(locale);
}

const showPassword = ref(false);
const showEmailForm = ref(false);

async function submit(): Promise<void> {
    flashError.value = null;
    try {
        await form.post<{ user: unknown; token: string; redirect_to: string }>(
            '/api/spa/auth/login',
            {
                onSuccess: async (data) => {
                    await auth.bootstrap();
                    router.push(data.redirect_to ?? '/');
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
        class="nativephp-safe-area relative flex h-dvh flex-col overflow-hidden bg-warmwhite px-6 dark:bg-sand-900"
    >
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div
                class="absolute -top-24 -left-24 size-72 rounded-full bg-sage-200/60 blur-3xl dark:bg-sage-700/20"
            ></div>
            <div
                class="absolute top-1/4 -right-28 size-80 rounded-full bg-accent-soft/40 blur-3xl dark:bg-accent/10"
            ></div>
            <div
                class="absolute -bottom-32 left-1/4 size-96 rounded-full bg-sand-200/50 blur-3xl dark:bg-sand-700/30"
            ></div>
        </div>

        <div aria-hidden="true" class="pointer-events-none absolute inset-0">
            <svg
                class="doodle doodle-1 absolute top-28 left-8 size-5 text-accent/70"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 2l2.1 6.9L21 11l-6.9 2.1L12 20l-2.1-6.9L3 11l6.9-2.1z"
                />
            </svg>
            <svg
                class="doodle doodle-2 absolute top-20 right-10 size-4 text-teal/60"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <circle cx="12" cy="12" r="6" />
            </svg>
            <svg
                class="doodle doodle-3 absolute top-1/2 right-6 size-6 text-accent/50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            >
                <path d="M3 12 Q 7 6, 11 12 T 19 12" />
            </svg>
            <svg
                class="doodle doodle-4 absolute bottom-32 left-6 size-5 text-sage-500/70"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"
                />
            </svg>
        </div>

        <div class="relative flex justify-end pt-4">
            <button
                class="rounded-full bg-white/70 px-3 py-2 font-semibold tracking-wider text-teal uppercase shadow-sm backdrop-blur-sm transition hover:scale-105 dark:bg-sand-800/60 dark:text-sand-200"
                @click="setLocale(currentLocale === 'nl' ? 'en' : 'nl')"
            >
                {{ currentLocale === 'nl' ? 'NL' : 'EN' }}
            </button>
        </div>

        <div class="relative flex flex-1 flex-col items-center justify-center">
            <div class="mb-8 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1 text-sage-700 shadow-sm dark:bg-sage-900/50 dark:text-sage-300"
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
                <p class="mt-3 text-sand-600 dark:text-sand-400">
                    {{ t('Safely share with those who matter') }}
                </p>
            </div>

            <div class="relative w-full max-w-xs">
                <div class="space-y-3">
                    <p
                        v-if="flashError"
                        class="rounded-xl bg-blush-50 px-3 py-2 text-center text-blush-600 dark:bg-blush-900/20"
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
                            <span
                                class="h-px flex-1 bg-sand-200 dark:bg-sand-700"
                            ></span>
                            <span
                                class="tracking-widest text-sand-400 uppercase dark:text-sand-500"
                                >{{ t('or') }}</span
                            >
                            <span
                                class="h-px flex-1 bg-sand-200 dark:bg-sand-700"
                            ></span>
                        </div>
                    </template>

                    <button
                        v-if="showEmailForm"
                        type="button"
                        class="group -ml-1 inline-flex items-center gap-1 rounded-full py-1 text-teal transition hover:text-teal-light"
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
                        <div>
                            <input
                                v-model="form.data.email"
                                type="email"
                                name="email"
                                :placeholder="t('Email address')"
                                autocomplete="email"
                                class="field"
                                :class="
                                    form.errors.email
                                        ? 'border-blush-400 focus:border-blush-400 focus:ring-1 focus:ring-blush-400'
                                        : 'border-sand-200 focus:border-sand-400 focus:ring-1 focus:ring-sand-400 dark:border-sand-700'
                                "
                            />
                        </div>

                        <div class="relative">
                            <input
                                v-model="form.data.password"
                                :type="showPassword ? 'text' : 'password'"
                                name="password"
                                :placeholder="t('Password')"
                                autocomplete="current-password"
                                class="field pr-16"
                                :class="
                                    form.errors.password
                                        ? 'border-blush-400 focus:border-blush-400 focus:ring-1 focus:ring-blush-400'
                                        : 'border-sand-200 focus:border-sand-400 focus:ring-1 focus:ring-sand-400 dark:border-sand-700'
                                "
                            />
                            <button
                                type="button"
                                class="absolute top-1/2 right-3 -translate-y-1/2 text-sand-400 dark:text-sand-500"
                                @click="showPassword = !showPassword"
                            >
                                {{ showPassword ? t('Hide') : t('Show') }}
                            </button>
                        </div>

                        <Button
                            type="submit"
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
                    </form>

                    <button
                        v-else
                        type="button"
                        class="group flex w-full items-center justify-center gap-1.5 pt-1 text-center text-teal transition hover:text-teal-light"
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
            <p class="text-center text-sand-500 dark:text-sand-400">
                {{ t('New to innerr?') }}
                <a
                    href="/register"
                    class="font-semibold text-teal decoration-accent decoration-wavy decoration-2 underline-offset-4 hover:underline"
                >
                    {{ t('Create an account') }}
                </a>
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
