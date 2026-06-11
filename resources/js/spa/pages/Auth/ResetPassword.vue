<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import LanguageSelector from '@/spa/components/LanguageSelector.vue';
import TextField from '@/spa/components/TextField.vue';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import keyIcon from '../../../../svg/doodle-icons/key.svg';
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
const route = useRoute();
const router = useRouter();

const flashError = ref<string | null>(null);
const flashSuccess = ref<string | null>(null);

const form = useApiForm({
    token: '',
    email: '',
    password: '',
});

onMounted(() => {
    const token = route.query.token;
    const email = route.query.email;

    if (typeof token === 'string') {
        form.data.token = token;
    }

    if (typeof email === 'string') {
        form.data.email = email;
    }
});

async function submit(): Promise<void> {
    flashError.value = null;
    flashSuccess.value = null;

    try {
        await form.post<{ message: string }>('/api/spa/auth/reset-password', {
            onSuccess: (data) => {
                flashSuccess.value =
                    data.message ?? t('Your password has been reset');
                setTimeout(() => {
                    router.push({ name: 'spa.login' });
                }, 1500);
            },
            onFinish: () => form.reset('password'),
        });
    } catch (error) {
        if (error instanceof ApiError) {
            flashError.value = error.message || t('Could not reset password');
        } else {
            flashError.value = t('Could not connect to the server');
        }
    }
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
                    {{ t('new password') }}
                    <span
                        aria-hidden="true"
                        class="inline-block size-4 bg-current"
                        :style="iconMaskStyle(keyIcon)"
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
                    {{ t('Choose a new password for your account') }}
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

                    <p
                        v-if="flashSuccess"
                        class="rounded-xl bg-brand-yellow/20 px-3 py-2 text-center text-brand-yellow"
                    >
                        {{ flashSuccess }}
                    </p>

                    <form class="space-y-3" @submit.prevent="submit">
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
                            :placeholder="t('New password')"
                            autocomplete="new-password"
                            :error="form.errors.password"
                        />

                        <Button
                            type="submit"
                            variant="inverse"
                            size="lg"
                            block
                            :loading="form.processing"
                            :disabled="
                                !form.data.email ||
                                !form.data.password ||
                                !form.data.token
                            "
                        >
                            {{ t('Reset password') }}
                        </Button>

                        <p
                            v-if="!form.data.token"
                            class="text-center text-brand-sand/70"
                        >
                            {{ t('Reset token is missing or invalid') }}
                        </p>
                    </form>
                </div>
            </div>
        </div>

        <div class="relative pt-4 pb-8">
            <p class="text-center text-brand-sand/80">
                {{ t('Remember your password?') }}
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
