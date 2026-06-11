<script setup lang="ts">
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAppUpdateStore } from '@/spa/stores/appUpdate';
import { Browser } from '@nativephp/mobile';
import downloadIcon from '../../../svg/doodle-icons/download.svg';

/* Dismissible "update available" card for the feeds. Visibility is driven by
   the appUpdate store (server latest_version vs the running version);
   dismissing remembers the skipped version, so the card returns only when an
   even newer release ships. */
const { t } = useTranslations();
const appUpdate = useAppUpdateStore();

async function openStore(): Promise<void> {
    const url = appUpdate.storeUrl;

    if (!url) {
        return;
    }

    try {
        await Browser.open(url);
    } catch {
        window.open(url, '_blank');
    }
}

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
</script>

<template>
    <div
        v-if="appUpdate.updateAvailable"
        class="reveal-item relative overflow-hidden rounded-2xl bg-surface/80 p-5 shadow-sm ring-1 ring-sand-200/70 backdrop-blur-sm"
    >
        <!-- A new release is a small celebration: warm yellow glow, film
             grain and a couple of sparkles around the gift. -->
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
            <div
                class="absolute -top-10 -right-8 size-32 rounded-full bg-brand-yellow/30 blur-2xl"
            ></div>
            <div class="absolute inset-0 grain opacity-[0.04]"></div>
            <svg
                class="absolute top-3 right-10 size-3 text-brand-orange/70"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"
                />
            </svg>
            <svg
                class="absolute top-9 right-5 size-2 text-brand-green/60"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <circle cx="12" cy="12" r="10" />
            </svg>
        </div>

        <button
            type="button"
            class="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-brand-blue/60 transition-colors hover:bg-brand-blue/10 hover:text-brand-blue dark:text-ink-muted"
            :aria-label="t('Dismiss')"
            @click="appUpdate.dismissCurrent()"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="size-4"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                />
            </svg>
        </button>

        <div class="relative flex items-start gap-4">
            <div
                class="flex size-12 shrink-0 rotate-[-6deg] items-center justify-center rounded-xl bg-brand-yellow text-brand-blue shadow-sm"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6 bg-current"
                    :style="iconMaskStyle(downloadIcon)"
                ></span>
            </div>
            <div class="flex-1 pr-6">
                <span
                    v-if="appUpdate.latestVersion"
                    class="inline-block rounded-full bg-brand-yellow px-2 py-0.5 text-[11px] leading-tight font-semibold text-brand-blue"
                >
                    v{{ appUpdate.latestVersion }}
                </span>
                <h3 class="mt-1 font-semibold text-ink">
                    {{ t('A new version of innerr is available') }}
                </h3>
                <p class="mt-1 text-sm leading-relaxed text-ink-muted">
                    {{ t('Update to get the latest improvements and fixes.') }}
                </p>
                <button
                    type="button"
                    class="mt-3 rounded-full bg-action px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-action-hover"
                    @click="openStore"
                >
                    {{ t('Update now') }}
                </button>
            </div>
        </div>
    </div>
</template>
