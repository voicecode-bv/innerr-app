<script setup lang="ts">
import { onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Events, On, PushNotifications } from '@nativephp/mobile';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAuthStore } from '@/spa/stores/auth';
import { externalApi } from '@/spa/http/externalApi';
import cameraIcon from '../../../../svg/doodle-icons/camera.svg';
import heartIcon from '../../../../svg/doodle-icons/heart.svg';
import messageIcon from '../../../../svg/doodle-icons/message.svg';
import settingIcon from '../../../../svg/doodle-icons/setting.svg';

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();

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

const items = [
    {
        icon: cameraIcon,
        title: t('New photos'),
        description: t('Someone in your circle shared a new moment'),
    },
    {
        icon: heartIcon,
        title: t('Likes'),
        description: t('Someone liked your photo or comment'),
    },
    {
        icon: messageIcon,
        title: t('Comments'),
        description: t('Someone replied to your photo or comment'),
    },
    {
        icon: settingIcon,
        title: t('Always in your control'),
        description: t(
            'You decide in Settings which notifications you want to receive.',
        ),
    },
];

async function sendToken(token: string): Promise<void> {
    try {
        await externalApi.post('/device-token', { token });
    } catch {
        // Niet kritiek voor onboarding flow.
    }
}

const tokenListenerOff = On(
    Events.PushNotification.TokenGenerated,
    async ({ token }: { token: string }) => {
        await sendToken(token);
    },
);

onUnmounted(() => {
    if (typeof tokenListenerOff === 'function') {
        tokenListenerOff();
    }
});

async function completeOnboarding(): Promise<void> {
    try {
        await externalApi.post('/onboarding/complete');
    } catch {
        // Niet kritiek; bootstrap haalt straks alsnog onboarded-status op.
    }
    await auth.bootstrap();
    router.push('/');
}

async function enableNotifications(): Promise<void> {
    try {
        await PushNotifications.enroll();
        const result = await PushNotifications.getToken();
        if (result?.token) {
            await sendToken(result.token);
        }
    } catch {
        // Permission denied of niet beschikbaar — door naar complete.
    }
    await completeOnboarding();
}

function skip(): void {
    completeOnboarding();
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
                    {{ t('Notifications') }}
                </p>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-teal"
                >
                    {{ t('Stay in the loop') }}
                </h1>
                <p class="mt-3 max-w-xs text-sand-600 dark:text-sand-400">
                    {{
                        t(
                            "Enable notifications so you never miss a moment. We'll let you know when:",
                        )
                    }}
                </p>
            </div>

            <ul class="w-full max-w-sm space-y-4">
                <li
                    v-for="(item, index) in items"
                    :key="index"
                    class="relative flex items-start gap-4 rounded-lg bg-white/20 p-4 shadow-sm backdrop-blur-sm dark:border-sand-700/50 dark:bg-sand-800/60"
                >
                    <div
                        class="flex size-14 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-teal dark:bg-sage-900/40"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-8 bg-current"
                            :style="iconMaskStyle(item.icon)"
                        ></span>
                    </div>
                    <div class="flex-1 pt-1">
                        <h2
                            class="font-sans text-base font-semibold text-sand-800 dark:text-sand-100"
                        >
                            {{ item.title }}
                        </h2>
                        <p
                            class="mt-1 leading-relaxed text-sand-600 dark:text-sand-400"
                        >
                            {{ item.description }}
                        </p>
                    </div>
                </li>
            </ul>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="w-full rounded-lg bg-teal py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-teal-light"
                @click="enableNotifications"
            >
                {{ t('Enable notifications') }}
            </button>
            <button
                class="mt-3 w-full py-2 text-sand-500 dark:text-sand-400"
                @click="skip"
            >
                {{ t('Maybe later') }}
            </button>
        </div>
    </div>
</template>
