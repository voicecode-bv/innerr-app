<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import OnboardingHeader from '@/spa/components/OnboardingHeader.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { trackOnboardingStep } from '@/spa/http/onboarding';
import cameraIcon from '../../../../svg/doodle-icons/camera.svg';

interface Circle {
    id: string;
    name: string;
}

const { t } = useTranslations();
const route = useRoute();
const router = useRouter();

const circleId = String(route.params.circle);
const circle = ref<Circle | null>(null);

onMounted(async () => {
    try {
        const data = await externalApi.get<{ data: Circle }>(
            `/circles/${circleId}`,
        );
        circle.value = { id: data.data.id, name: data.data.name };
    } catch {
        // Cosmetic: the badge simply stays empty.
    }
});

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

// Hands off to the regular CreatePost wizard; the onboarding flag makes it
// return to the invite step (and track this step) after sharing.
function chooseAPhoto(): void {
    router.push({
        name: 'spa.posts.create',
        query: { onboarding: '1', circle: circleId },
    });
}

function shareLater(): void {
    trackOnboardingStep('first_moment');
    router.push({
        name: 'spa.onboarding.invite-members',
        params: { circle: circleId },
    });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative isolate flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-ink"
    >
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 -z-10"
        >
            <div
                class="absolute -top-20 -right-16 size-72 rounded-full bg-brand-yellow/20 blur-3xl"
            ></div>
            <div
                class="absolute bottom-10 -left-20 size-72 rounded-full bg-sage-200/40 blur-3xl"
            ></div>
            <div class="absolute inset-0 grain opacity-[0.04]"></div>
        </div>

        <OnboardingHeader
            :step="2"
            :back-to="{
                name: 'spa.onboarding.add-children',
                params: { circle: circleId },
            }"
        />

        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-8 text-center">
                <span
                    class="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success-ink shadow-sm"
                >
                    {{ circle?.name ?? ' ' }}
                </span>
                <h1
                    class="mt-3 text-4xl font-extrabold tracking-tight text-ink"
                >
                    {{ t('Share your first moment') }}
                </h1>
                <p class="mx-auto mt-3 max-w-xs text-ink-muted">
                    {{
                        t(
                            'Pick a favourite photo from your gallery. It lands in the timeline on the day it was taken.',
                        )
                    }}
                </p>
            </div>

            <!-- A single waiting polaroid: the empty slot this step fills. -->
            <div
                aria-hidden="true"
                class="pointer-events-none w-36 rotate-[-4deg] polaroid"
            >
                <div
                    class="flex aspect-square items-center justify-center rounded-sm bg-gradient-to-br from-sage-200 to-sand-100"
                >
                    <span
                        class="inline-block size-12 bg-sage-600/70"
                        :style="iconMaskStyle(cameraIcon)"
                    ></span>
                </div>
                <p
                    class="truncate py-2 text-center text-xs font-medium text-night/60"
                >
                    {{ t('First steps') }}
                </p>
            </div>
        </div>

        <!-- Skipping is a text link, not a primary button: filling the step
             in should look more attractive than skipping it. -->
        <div class="relative pt-2 pb-8">
            <button
                class="w-full rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover"
                @click="chooseAPhoto"
            >
                {{ t('Choose a photo') }}
            </button>
            <button
                class="mt-3 w-full py-2 font-medium text-ink-muted transition-colors hover:text-ink"
                @click="shareLater"
            >
                {{ t('Share later') }}
            </button>
        </div>
    </div>
</template>
