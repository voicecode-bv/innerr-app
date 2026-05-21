<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
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
import { useI18nStore } from '@/spa/stores/i18n';
import thumbsUpIcon from '../../../../svg/doodle-icons/thumbs-up.svg';
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
const i18n = useI18nStore();
const auth = useAuthStore();
const { redirectAfterAuth } = useInviteRedeem();

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

const showEmailForm = ref(false);

async function submit(): Promise<void> {
    flashError.value = null;

    try {
        await form.post<{ user: unknown; token: string; redirect_to: string }>(
            '/api/spa/auth/register',
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
            flashError.value = error.message || t('Registration failed');
        } else {
            flashError.value = t('Could not connect to the server');
        }
    }
}

function lowercase(value: string): string {
    return value.toLowerCase();
}
</script>

<template>
    <div
        class="nativephp-safe-area relative isolate flex min-h-dvh flex-col overflow-hidden bg-brand-blue px-6 text-brand-sand"
    >
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 -z-10"
        >
            <svg
                class="doodle doodle-1 absolute top-28 right-10 size-12 text-brand-yellow/70"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 2l2.1 6.9L21 11l-6.9 2.1L12 20l-2.1-6.9L3 11l6.9-2.1z"
                />
            </svg>
            <svg
                class="doodle doodle-2 absolute top-24 left-10 size-14 text-brand-yellow/55"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            >
                <path d="M3 12 Q 7 6, 11 12 T 19 12" />
            </svg>
            <svg
                class="doodle doodle-3 absolute top-1/2 left-8 size-10 text-brand-sand/40"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <circle cx="12" cy="12" r="6" />
            </svg>
            <svg
                class="doodle doodle-4 absolute right-8 bottom-28 size-12 text-brand-yellow/65"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"
                />
            </svg>
            <svg
                class="doodle doodle-2 absolute bottom-12 left-12 size-12 text-brand-sand/35"
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
        </div>

        <div class="relative flex items-center justify-between pt-4">
            <RouterLink
                :to="{ name: 'spa.login' }"
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

        <div
            class="relative flex flex-1 flex-col items-center justify-center py-6"
        >
            <div class="mb-8 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-3 py-1 text-sm font-medium text-brand-blue shadow-sm"
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
                            :label="t('Sign up with Apple')"
                        />
                        <GoogleAuthButton
                            :url="socialAuthUrls.google"
                            :label="t('Sign up with Google')"
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
                            v-model="form.data.name"
                            name="name"
                            :placeholder="t('Your name')"
                            autocomplete="name"
                            :error="form.errors.name"
                        />

                        <TextField
                            v-model="form.data.email"
                            type="email"
                            name="email"
                            :placeholder="t('Email address')"
                            autocomplete="email"
                            :error="form.errors.email"
                        />

                        <TextField
                            v-model="form.data.username"
                            name="username"
                            :placeholder="t('Username')"
                            autocomplete="username"
                            :error="form.errors.username"
                            :transform="lowercase"
                        />

                        <TextField
                            v-model="form.data.password"
                            type="password"
                            name="password"
                            :placeholder="t('Password')"
                            autocomplete="new-password"
                            :error="form.errors.password"
                        />

                        <label
                            for="terms"
                            class="flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-sand/10 px-4 py-3 leading-relaxed text-brand-sand/90 ring-1 ring-brand-sand/15 backdrop-blur-sm transition hover:bg-brand-sand/15"
                        >
                            <span class="relative mt-0.5 size-5 shrink-0">
                                <input
                                    id="terms"
                                    v-model="form.data.terms_accepted"
                                    type="checkbox"
                                    class="peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-md border-2 border-brand-sand/40 bg-transparent checked:border-brand-yellow checked:bg-brand-yellow focus:ring-2 focus:ring-brand-yellow/40 focus:ring-offset-0 focus:outline-none"
                                />
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 20 20"
                                    class="pointer-events-none absolute inset-0 hidden size-5 text-brand-blue peer-checked:block"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <polyline points="5 10.5 8.5 14 15 6.5" />
                                </svg>
                            </span>
                            <span>
                                {{ t('I agree to the') }}
                                <a
                                    :href="termsUrl"
                                    target="_blank"
                                    class="font-semibold text-brand-yellow decoration-brand-yellow/60 decoration-wavy decoration-2 underline-offset-4 hover:underline"
                                    @click.stop
                                    >{{ t('Terms and Conditions') }}</a
                                >
                            </span>
                        </label>
                        <p
                            v-if="form.errors.terms_accepted"
                            class="-mt-1 px-1 text-brand-yellow"
                        >
                            {{ form.errors.terms_accepted }}
                        </p>

                        <Button
                            type="submit"
                            variant="inverse"
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
                        class="group flex w-full items-center justify-center gap-1.5 pt-1 text-center text-brand-yellow transition hover:text-brand-yellow/80"
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
            <p class="text-center text-brand-sand/80">
                {{ t('Already have an account?') }}
                <RouterLink
                    :to="{ name: 'spa.login' }"
                    class="font-semibold text-brand-yellow decoration-brand-yellow/60 decoration-wavy decoration-2 underline-offset-4 hover:underline"
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
