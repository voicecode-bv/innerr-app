<script setup lang="ts">
import Button from '@/components/Button.vue';
import LanguageSelector from '@/spa/components/LanguageSelector.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAuthStore } from '@/spa/stores/auth';
import cakeIcon from '../../../../svg/doodle-icons/cake.svg';
import cameraIcon from '../../../../svg/doodle-icons/camera.svg';
import handIcon from '../../../../svg/doodle-icons/hand.svg';
import heartFilledIcon from '../../../../svg/doodle-icons/heart-filled.svg';
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

/* The fanned snapshot stack: three little polaroids that deal themselves in
   one by one. Pure decoration, but it is the first thing a new family sees,
   so it has to feel like the product: warm, tactile, slightly imperfect. */
const snapshots = [
    {
        icon: cameraIcon,
        caption: t('First steps'),
        photoClass: 'from-sage-200 to-sand-100',
        iconClass: 'bg-sage-600/70',
        tilt: '-8deg',
        x: '-5.5rem',
        y: '0.75rem',
        delay: '650ms',
    },
    {
        icon: cakeIcon,
        caption: t('Birthday'),
        photoClass: 'from-brand-yellow/70 to-sand-100',
        iconClass: 'bg-brand-blue/60',
        tilt: '7deg',
        x: '5.5rem',
        y: '1.1rem',
        delay: '800ms',
    },
    {
        icon: heartFilledIcon,
        caption: t("At grandma's"),
        photoClass: 'from-accent-soft/50 to-sand-100',
        iconClass: 'bg-brand-orange/80',
        tilt: '-1.5deg',
        x: '0rem',
        y: '0rem',
        delay: '950ms',
    },
];
</script>

<template>
    <div
        class="nativephp-safe-area relative isolate flex h-dvh flex-col overflow-hidden bg-brand-blue px-6"
    >
        <!-- Atmosphere: soft colour glows + film grain keep the big blue
             surface from feeling flat, doodles float at different depths. -->
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 -z-10"
        >
            <div
                class="absolute -top-24 -left-20 size-80 rounded-full bg-brand-yellow/15 blur-3xl"
            ></div>
            <div
                class="absolute right-[-6rem] bottom-[-4rem] size-96 rounded-full bg-teal-light/40 blur-3xl"
            ></div>
            <div
                class="absolute top-1/3 left-[-4rem] size-56 rounded-full bg-brand-green/10 blur-3xl"
            ></div>
            <div class="absolute inset-0 grain opacity-[0.06]"></div>

            <svg
                class="doodle doodle-1 absolute top-28 left-8 size-12 text-brand-yellow/60"
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
                class="doodle doodle-2 absolute top-20 right-10 size-7 text-brand-sand/30"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <circle cx="12" cy="12" r="6" />
            </svg>
            <svg
                class="doodle doodle-4 absolute bottom-36 left-5 size-11 text-brand-yellow/55"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"
                />
            </svg>
            <svg
                class="doodle doodle-1 absolute right-10 bottom-28 size-12 text-brand-sand/30"
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
            <svg
                class="doodle doodle-2 absolute top-1/2 right-6 size-8 text-brand-green/35"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            >
                <path d="M12 19V7" />
                <path d="M12 7c0-2.5 2-4 4.5-4C16.5 5.5 14.5 7 12 7z" />
                <path d="M12 11c0-2.5-2-4-4.5-4C7.5 9.5 9.5 11 12 11z" />
            </svg>
        </div>

        <div class="relative flex justify-end pt-4">
            <LanguageSelector />
        </div>

        <div class="relative flex flex-1 flex-col items-center justify-center">
            <div class="text-center">
                <span
                    class="enter enter-1 inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-3 py-1 text-sm font-medium text-brand-blue shadow-sm"
                >
                    {{ t('welcome') }}
                    <span
                        aria-hidden="true"
                        class="inline-block size-4 origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite] bg-current"
                        :style="iconMaskStyle(handIcon)"
                    ></span>
                </span>
                <h1 class="enter enter-2 mt-4">
                    <img
                        :src="innerrLogo"
                        alt="innerr"
                        class="mx-auto h-16 w-auto"
                    />
                </h1>
                <p
                    class="enter enter-3 mt-3 text-base font-medium text-brand-sand/85"
                >
                    {{ t('The private album for your family') }}
                </p>
            </div>

            <!-- Snapshot fan: three tilted polaroids dealing in one by one. -->
            <div
                aria-hidden="true"
                class="pointer-events-none relative mt-9 mb-8 flex h-40 w-full items-center justify-center"
            >
                <div
                    v-for="(snap, index) in snapshots"
                    :key="snap.caption"
                    class="deal absolute w-28 polaroid"
                    :style="{
                        '--tilt': snap.tilt,
                        '--x': snap.x,
                        '--y': snap.y,
                        animationDelay: snap.delay,
                        zIndex: index === snapshots.length - 1 ? 2 : 1,
                    }"
                >
                    <div
                        class="flex aspect-square items-center justify-center rounded-sm bg-gradient-to-br"
                        :class="snap.photoClass"
                    >
                        <span
                            class="inline-block size-10"
                            :class="snap.iconClass"
                            :style="iconMaskStyle(snap.icon)"
                        ></span>
                    </div>
                    <p
                        class="truncate py-1.5 text-center text-[11px] font-medium text-night/65"
                    >
                        {{ snap.caption }}
                    </p>
                </div>
            </div>

            <div class="w-full max-w-xs space-y-3">
                <div class="enter enter-4">
                    <Button
                        :to="{ name: 'spa.register' }"
                        variant="inverse"
                        size="lg"
                        block
                        class="shine"
                    >
                        {{ t('Create an account') }}
                    </Button>
                </div>

                <div class="enter enter-5">
                    <Button
                        :to="{ name: 'spa.login' }"
                        variant="secondary"
                        size="lg"
                        block
                    >
                        {{ t('I already have an account') }}
                    </Button>
                </div>
            </div>
        </div>

        <p
            v-if="auth.appVersion"
            class="relative pb-4 text-center text-xs text-brand-sand/50"
        >
            {{ t('Version :version', { version: auth.appVersion }) }}
        </p>
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
.doodle-4 {
    animation-delay: 0.6s;
    animation-duration: 6.5s;
}

/* Page-load choreography: badge, wordmark, tagline and buttons rise in
   sequence, then the polaroids deal themselves onto the table. */
.enter {
    opacity: 0;
    animation: enter-up 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.enter-1 {
    animation-delay: 100ms;
}
.enter-2 {
    animation-delay: 220ms;
}
.enter-3 {
    animation-delay: 340ms;
}
.enter-4 {
    animation-delay: 1050ms;
}
.enter-5 {
    animation-delay: 1150ms;
}

@keyframes enter-up {
    from {
        opacity: 0;
        transform: translateY(14px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.deal {
    opacity: 0;
    transform: translate(var(--x), calc(var(--y) + 2.5rem)) rotate(0deg)
        scale(0.92);
    animation: deal-in 650ms var(--ease-spring) forwards;
}

@keyframes deal-in {
    to {
        opacity: 1;
        transform: translate(var(--x), var(--y)) rotate(var(--tilt)) scale(1);
    }
}

@media (prefers-reduced-motion: reduce) {
    .enter,
    .deal {
        opacity: 1;
        animation: none;
        transform: translate(var(--x, 0), var(--y, 0)) rotate(var(--tilt, 0deg));
    }
}
</style>
