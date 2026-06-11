<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Spinner from '@/components/Spinner.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { trackOnboardingStep } from '@/spa/http/onboarding';
import { useCirclesStore } from '@/spa/stores/circles';
import type { Circle } from '@/spa/stores/circles';
import { useDefaultCirclesStore } from '@/spa/stores/defaultCircles';
import cameraIcon from '../../../../svg/doodle-icons/camera.svg';
import heartIcon from '../../../../svg/doodle-icons/heart.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const router = useRouter();
const circles = useCirclesStore();
const processing = ref(false);

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

const steps = [
    {
        icon: userIcon,
        title: t('Build your family circle'),
        description: t(
            'Add the people you trust, like grandparents and godparents. Only people you invite can see your child.',
        ),
    },
    {
        icon: cameraIcon,
        title: t("Share your child's moments"),
        description: t(
            'Post photos and videos of your little one. No public feed, no strangers.',
        ),
    },
    {
        icon: heartIcon,
        title: t('Keep family close'),
        description: t(
            'Let faraway family watch your child grow up. Calmly, privately, together.',
        ),
    },
];

// Self-healing fallback: register normally creates the "Family" circle, but
// OAuth signups never pass through that bootstrap and the register-time call
// is best-effort. Creating it here (and marking it as the default circle for
// new posts) keeps every signup path on the full onboarding.
async function createFamilyCircle(): Promise<Circle | null> {
    try {
        const created = await externalApi.post<{ data: Circle }>('/circles', {
            name: t('Family'),
        });

        circles.prepend(created.data);

        try {
            await externalApi.put('/default-circles', {
                circle_ids: [created.data.id],
            });
            useDefaultCirclesStore().invalidate();
        } catch {
            // Default-circle assignment is a convenience; the circle itself
            // is what the next steps need.
        }

        return created.data;
    } catch {
        return null;
    }
}

// De "Familie"-kring wordt bij registratie al door de API aangemaakt, dus we
// laden de kringen en springen direct naar de kinderen-stap van die kring.
// Ontbreekt de kring (OAuth-signup of gefaalde register-bootstrap), dan maken
// we hem hier alsnog aan; alleen als ook dat mislukt slaan we de kring-stappen
// over richting notificaties.
async function continueOnboarding(): Promise<void> {
    if (processing.value) {
        return;
    }

    trackOnboardingStep('intro');
    processing.value = true;

    try {
        const items = await circles.refresh();
        // Only a circle the user OWNS will accept their children and rules; a
        // fresh account can already be a member of someone else's circle
        // (redeemed invite link, linked OAuth account).
        const familyCircle =
            items.find((c) => c.is_owner) ?? (await createFamilyCircle());

        if (familyCircle) {
            await router.push({
                name: 'spa.onboarding.add-children',
                params: { circle: familyCircle.id },
            });
        } else {
            await router.push({ name: 'spa.onboarding.notifications' });
        }
    } catch {
        await router.push({ name: 'spa.onboarding.notifications' });
    } finally {
        processing.value = false;
    }
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
                    {{ t('How it works') }}
                </span>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-ink"
                >
                    {{ t('Welcome to innerr') }}
                </h1>
                <p class="mt-3 text-ink-muted">
                    {{
                        t(
                            'A private album for your family, in three simple steps.',
                        )
                    }}
                </p>
            </div>

            <ol class="mt-8 w-full max-w-sm space-y-4">
                <li
                    v-for="(step, index) in steps"
                    :key="index"
                    class="relative flex items-start gap-4 rounded-lg bg-surface/50 p-4 shadow-sm backdrop-blur-sm"
                >
                    <div class="relative shrink-0">
                        <div
                            class="flex size-14 items-center justify-center rounded-lg bg-success-soft text-ink"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-8 bg-current"
                                :style="iconMaskStyle(step.icon)"
                            ></span>
                        </div>
                        <span
                            class="absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full bg-accent leading-none font-semibold text-white shadow-md"
                        >
                            {{ index + 1 }}
                        </span>
                    </div>
                    <div class="flex-1 pt-1">
                        <h2 class="font-sans text-base font-semibold text-ink">
                            {{ step.title }}
                        </h2>
                        <p class="mt-1 leading-relaxed text-ink-muted">
                            {{ step.description }}
                        </p>
                    </div>
                </li>
            </ol>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="processing"
                @click="continueOnboarding"
            >
                <Spinner v-if="processing" class="size-4" />
                {{ t('Continue') }}
            </button>
        </div>
    </div>
</template>
