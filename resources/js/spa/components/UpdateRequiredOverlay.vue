<script setup lang="ts">
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAppUpdateStore } from '@/spa/stores/appUpdate';
import { Browser } from '@nativephp/mobile';
import downloadIcon from '../../../svg/doodle-icons/download.svg';

/* Blocking screen shown when the running version is below the server's
   minimum_version: the API may no longer be compatible, so the only way
   forward is the store. Mounted in App.vue above everything else. */
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
        class="nativephp-safe-area fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-sand px-8 text-center"
        role="dialog"
        aria-modal="true"
    >
        <div
            class="flex size-20 items-center justify-center rounded-3xl bg-success-soft text-ink"
        >
            <span
                aria-hidden="true"
                class="inline-block size-10 bg-current"
                :style="iconMaskStyle(downloadIcon)"
            ></span>
        </div>
        <h1
            class="mt-6 font-display text-3xl font-black tracking-tight text-ink"
        >
            {{ t('Update required') }}
        </h1>
        <p class="mx-auto mt-3 max-w-xs text-ink-muted">
            {{
                t(
                    'This version of innerr is no longer supported. Update the app to keep sharing moments.',
                )
            }}
        </p>
        <button
            v-if="appUpdate.storeUrl"
            type="button"
            class="mt-8 w-full max-w-xs rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover"
            @click="openStore"
        >
            {{ t('Update now') }}
        </button>
    </div>
</template>
