<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AppleAuthButton from '@/spa/components/auth/AppleAuthButton.vue';
import GoogleAuthButton from '@/spa/components/auth/GoogleAuthButton.vue';
import Button from '@/components/Button.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useAuthStore } from '@/spa/stores/auth';
import { useI18nStore } from '@/spa/stores/i18n';
import { ApiError } from '@/spa/http/apiClient';
import thumbsUpIcon from '../../../../svg/doodle-icons/thumbs-up.svg';
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

const currentLocale = computed(() => i18n.locale);
const socialAuthUrls = computed(() => auth.socialAuthUrls);
const flashError = ref<string | null>(null);

const termsUrl = computed(() =>
    currentLocale.value === 'nl'
        ? 'https://innerr.app/nl/voorwaarden/'
        : 'https://innerr.app/en/terms/',
);

const form = useApiForm({
    email: '',
    name: '',
    username: '',
    password: '',
    terms_accepted: false,
});

const showPassword = ref(false);
const showEmailForm = ref(false);

async function submit(): Promise<void> {
    flashError.value = null;
    try {
        await form.post<{ user: unknown; token: string; redirect_to: string }>(
            '/api/spa/auth/register',
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
            flashError.value = error.message || t('Registration failed');
        } else {
            flashError.value = t('Could not connect to the server');
        }
    }
}

function lowercaseUsername(event: Event): void {
    form.data.username = (event.target as HTMLInputElement).value.toLowerCase();
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
                class="absolute -top-24 -right-24 size-72 rounded-full bg-accent-soft/40 blur-3xl dark:bg-accent/10"
            ></div>
            <div
                class="absolute top-1/3 -left-28 size-80 rounded-full bg-sage-200/60 blur-3xl dark:bg-sage-700/20"
            ></div>
            <div
                class="absolute right-1/4 -bottom-32 size-96 rounded-full bg-sand-200/50 blur-3xl dark:bg-sand-700/30"
            ></div>
        </div>

        <div aria-hidden="true" class="pointer-events-none absolute inset-0">
            <svg
                class="doodle doodle-1 absolute top-28 right-10 size-5 text-accent/70"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 2l2.1 6.9L21 11l-6.9 2.1L12 20l-2.1-6.9L3 11l6.9-2.1z"
                />
            </svg>
            <svg
                class="doodle doodle-2 absolute top-24 left-10 size-6 text-sage-500/70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            >
                <path d="M3 12 Q 7 6, 11 12 T 19 12" />
            </svg>
            <svg
                class="doodle doodle-3 absolute top-1/2 left-8 size-4 text-teal/60"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <circle cx="12" cy="12" r="6" />
            </svg>
            <svg
                class="doodle doodle-4 absolute right-8 bottom-28 size-5 text-accent/60"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"
                />
            </svg>
        </div>

        <div class="relative flex justify-start pt-4">
            <RouterLink
                :to="{ name: 'spa.login' }"
                class="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-2 text-teal shadow-sm backdrop-blur-sm transition hover:-translate-x-0.5 dark:bg-sand-800/60 dark:text-sand-300"
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
        </div>

        <div
            class="relative flex flex-1 flex-col items-center justify-center py-6"
        >
            <div class="mb-8 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft/40 px-3 py-1 text-accent shadow-sm dark:bg-accent/20"
                >
                    {{ t("let's begin") }}
                    <span
                        aria-hidden="true"
                        class="inline-block size-4 origin-bottom animate-[sprout_3s_ease-in-out_infinite] bg-current"
                        :style="iconMaskStyle(thumbsUpIcon)"
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
                            :label="t('Sign up with Apple')"
                        />
                        <GoogleAuthButton
                            :url="socialAuthUrls.google"
                            :label="t('Sign up with Google')"
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
                                v-model="form.data.name"
                                type="text"
                                name="name"
                                :placeholder="t('Your name')"
                                autocomplete="name"
                                class="field"
                                :class="
                                    form.errors.name
                                        ? 'border-blush-400 focus:border-blush-400 focus:ring-1 focus:ring-blush-400'
                                        : 'border-sand-200 focus:border-sand-400 focus:ring-1 focus:ring-sand-400 dark:border-sand-700'
                                "
                            />
                            <p
                                v-if="form.errors.name"
                                class="mt-1 text-blush-500"
                            >
                                {{ form.errors.name }}
                            </p>
                        </div>

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
                            <p
                                v-if="form.errors.email"
                                class="mt-1 text-blush-500"
                            >
                                {{ form.errors.email }}
                            </p>
                        </div>

                        <div>
                            <input
                                :value="form.data.username"
                                type="text"
                                name="username"
                                :placeholder="t('Username')"
                                autocomplete="username"
                                class="field"
                                :class="
                                    form.errors.username
                                        ? 'border-blush-400 focus:border-blush-400 focus:ring-1 focus:ring-blush-400'
                                        : 'border-sand-200 focus:border-sand-400 focus:ring-1 focus:ring-sand-400 dark:border-sand-700'
                                "
                                @input="lowercaseUsername"
                            />
                            <p
                                v-if="form.errors.username"
                                class="mt-1 text-blush-500"
                            >
                                {{ form.errors.username }}
                            </p>
                        </div>

                        <div class="relative">
                            <input
                                v-model="form.data.password"
                                :type="showPassword ? 'text' : 'password'"
                                name="password"
                                :placeholder="t('Password')"
                                autocomplete="new-password"
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
                            <p
                                v-if="form.errors.password"
                                class="mt-1 text-blush-500"
                            >
                                {{ form.errors.password }}
                            </p>
                        </div>

                        <div
                            class="flex items-start gap-3 rounded-lg bg-sand-50 px-3 py-2.5 dark:bg-sand-800/60"
                        >
                            <input
                                id="terms"
                                v-model="form.data.terms_accepted"
                                type="checkbox"
                                class="mt-0.5 size-5 shrink-0 rounded border-sand-300 text-teal accent-teal focus:ring-teal dark:border-sand-600"
                            />
                            <label
                                for="terms"
                                class="leading-relaxed text-sand-600 dark:text-sand-400"
                            >
                                {{ t('I agree to the') }}
                                <a
                                    :href="termsUrl"
                                    target="_blank"
                                    class="font-semibold text-teal decoration-accent decoration-wavy decoration-2 underline-offset-4 hover:underline"
                                    >{{ t('Terms and Conditions') }}</a
                                >
                            </label>
                        </div>
                        <p
                            v-if="form.errors.terms_accepted"
                            class="mt-1 text-blush-500"
                        >
                            {{ form.errors.terms_accepted }}
                        </p>

                        <Button
                            type="submit"
                            size="lg"
                            block
                            :disabled="
                                form.processing ||
                                !form.data.email ||
                                !form.data.name ||
                                !form.data.username ||
                                !form.data.password ||
                                !form.data.terms_accepted
                            "
                        >
                            {{ form.processing ? '...' : t('Create account') }}
                        </Button>
                    </form>

                    <button
                        v-else
                        type="button"
                        class="group flex w-full items-center justify-center gap-1.5 pt-1 text-center text-teal transition hover:text-teal-light"
                        @click="showEmailForm = true"
                    >
                        <span>{{ t('Sign up with email') }}</span>
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
                {{ t('Already have an account?') }}
                <RouterLink
                    :to="{ name: 'spa.login' }"
                    class="font-semibold text-teal decoration-accent decoration-wavy decoration-2 underline-offset-4 hover:underline"
                >
                    {{ t('Log in') }}
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
