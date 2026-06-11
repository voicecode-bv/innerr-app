<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Spinner from '@/components/Spinner.vue';
import OnboardingHeader from '@/spa/components/OnboardingHeader.vue';
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

// Tracks which footer action is in flight: enrolling + completing take a few
// network round-trips, and without feedback a double tap could enroll twice.
const processingAction = ref<'enable' | 'skip' | null>(null);

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
    if (processingAction.value) {
        return;
    }

    processingAction.value = 'enable';

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

    try {
        await completeOnboarding();
    } finally {
        processingAction.value = null;
    }
}

async function skip(): Promise<void> {
    if (processingAction.value) {
        return;
    }

    processingAction.value = 'skip';

    try {
        await completeOnboarding();
    } finally {
        processingAction.value = null;
    }
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-ink"
    >
        <!-- 'history' back: this step has no circle param of its own, and the
             previous step (with param) is simply the prior history entry. -->
        <OnboardingHeader :step="4" back-to="history" />
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
                    class="mt-3 text-4xl font-extrabold tracking-tight text-ink"
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
                class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="processingAction !== null"
                @click="enableNotifications"
            >
                <Spinner v-if="processingAction === 'enable'" class="size-4" />
                {{ t('Enable notifications') }}
            </button>
            <button
                class="mt-3 inline-flex w-full items-center justify-center gap-2 py-2 text-ink-muted disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="processingAction !== null"
                @click="skip"
            >
                <Spinner v-if="processingAction === 'skip'" class="size-4" />
                {{ t('Maybe later') }}
            </button>
        </div>
    </div>
</template>
