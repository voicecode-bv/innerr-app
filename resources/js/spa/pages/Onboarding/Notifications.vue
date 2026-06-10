<script setup lang="ts">
import { onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { trackOnboardingStep } from '@/spa/http/onboarding';
import { useAuthStore } from '@/spa/stores/auth';
import { useFeatureTourStore } from '@/spa/stores/featureTour';
import { Events, Off, On, PushNotifications } from '@nativephp/mobile';
import cameraIcon from '../../../../svg/doodle-icons/camera.svg';
import heartIcon from '../../../../svg/doodle-icons/heart.svg';
import messageIcon from '../../../../svg/doodle-icons/message.svg';
import settingIcon from '../../../../svg/doodle-icons/setting.svg';

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();
const featureTourStore = useFeatureTourStore();

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

// On() returns void; detach via Off() with the same callback reference. The
// previous "call On()'s return value" version never removed the listener.
function onTokenGenerated({ token }: { token: string }): void {
    void sendToken(token);
}

On(Events.PushNotification.TokenGenerated, onTokenGenerated);

onUnmounted(() => {
    Off(Events.PushNotification.TokenGenerated, onTokenGenerated);
});

async function completeOnboarding(): Promise<void> {
    trackOnboardingStep('notifications');

    try {
        await externalApi.post('/onboarding/complete');
    } catch {
        // Niet kritiek; bootstrap haalt straks alsnog onboarded-status op.
    }

    await auth.bootstrap();
    // Start de feature-tour zodra de gebruiker op het hoofdscherm landt; de
    // FeatureTourMount in App.vue mount nu omdat `auth.user.onboarded` true is.
    featureTourStore.start();
    router.push('/');
}

async function enableNotifications(): Promise<void> {
    try {
        await PushNotifications.enroll();
        // getToken() levert de token-string zelf op (of null) — geen { token }.
        const token = await PushNotifications.getToken();

        if (token) {
            await sendToken(token);
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
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-ink"
    >
        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-10 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success-ink shadow-sm"
                >
                    {{ t('Notifications') }}
                </span>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-ink"
                >
                    {{ t('Stay in the loop') }}
                </h1>
                <p class="mx-auto mt-3 max-w-xs text-ink-muted">
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
                    class="relative flex items-start gap-4 rounded-lg bg-surface/20 p-4 shadow-sm backdrop-blur-sm"
                >
                    <div
                        class="flex size-14 shrink-0 items-center justify-center rounded-lg bg-success-soft text-ink"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-8 bg-current"
                            :style="iconMaskStyle(item.icon)"
                        ></span>
                    </div>
                    <div class="flex-1 pt-1">
                        <h2 class="font-sans text-base font-semibold text-ink">
                            {{ item.title }}
                        </h2>
                        <p class="mt-1 leading-relaxed text-ink-muted">
                            {{ item.description }}
                        </p>
                    </div>
                </li>
            </ul>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="w-full rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover"
                @click="enableNotifications"
            >
                {{ t('Enable notifications') }}
            </button>
            <button class="mt-3 w-full py-2 text-ink-muted" @click="skip">
                {{ t('Maybe later') }}
            </button>
        </div>
    </div>
</template>
