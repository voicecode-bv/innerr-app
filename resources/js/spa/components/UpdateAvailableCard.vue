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
        class="reveal-item relative rounded-lg border border-brand-blue/15 bg-brand-blue/5 p-5 shadow-sm backdrop-blur-sm"
    >
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

        <div class="flex items-start gap-3">
            <div
                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/15 text-brand-blue dark:text-ink-muted"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6 bg-current"
                    :style="iconMaskStyle(downloadIcon)"
                ></span>
            </div>
            <div class="flex-1 pr-6">
                <h3 class="font-semibold text-brand-blue dark:text-white">
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
