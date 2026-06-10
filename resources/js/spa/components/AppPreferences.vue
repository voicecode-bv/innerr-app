<script setup lang="ts">
import { computed } from 'vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import { useFeedLayout } from '@/spa/composables/useFeedLayout';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { useAppearanceStore } from '@/spa/stores/appearance';
import type { AppearanceMode } from '@/spa/stores/appearance';
import { useAuthStore } from '@/spa/stores/auth';
import { useI18nStore } from '@/spa/stores/i18n';
import masonryIcon from '../../../svg/doodle-icons/feed-masonry.svg';
import globeIcon from '../../../svg/doodle-icons/globe.svg';
import nightIcon from '../../../svg/doodle-icons/night.svg';

const { t } = useTranslations();
const auth = useAuthStore();
const i18n = useI18nStore();
const appearance = useAppearanceStore();
const { layout: feedLayout, setLayout: setFeedLayout } = useFeedLayout();

const currentLocale = computed(() => i18n.locale);
const currentAppearance = computed(() => appearance.mode);
const currentFeedLayout = computed(() => feedLayout.value);

const languageIconStyle = computed(() => ({
    maskImage: `url(${globeIcon})`,
    WebkitMaskImage: `url(${globeIcon})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
}));

const appearanceIconStyle = computed(() => ({
    maskImage: `url(${nightIcon})`,
    WebkitMaskImage: `url(${nightIcon})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
}));

const feedLayoutIconStyle = computed(() => ({
    maskImage: `url(${masonryIcon})`,
    WebkitMaskImage: `url(${masonryIcon})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
}));

function setAppearance(mode: AppearanceMode): void {
    appearance.set(mode);
}

async function setLocale(locale: string): Promise<void> {
    i18n.set(locale);

    if (auth.user) {
        auth.user.locale = locale;
    }

    try {
        await externalApi.put('/profile', { locale });
    } catch {
        // i18n is al lokaal toegepast; volgende bootstrap synct met server.
    }
}
</script>

<template>
    <SurfaceCard class="reveal-item">
        <div class="space-y-4">
            <div class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-ink-muted">
                    <span
                        aria-hidden="true"
                        class="inline-block size-3.5 bg-current"
                        :style="languageIconStyle"
                    ></span>
                    {{ t('Language') }}
                </span>
                <div
                    class="flex items-center gap-1 rounded-full bg-sand-100/70 p-0.5"
                >
                    <button
                        class="rounded-full px-3 py-1 transition"
                        :class="
                            currentLocale === 'nl'
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-ink-muted'
                        "
                        @click="setLocale('nl')"
                    >
                        NL
                    </button>
                    <button
                        class="rounded-full px-3 py-1 transition"
                        :class="
                            currentLocale === 'en'
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-ink-muted'
                        "
                        @click="setLocale('en')"
                    >
                        EN
                    </button>
                    <button
                        class="rounded-full px-3 py-1 transition"
                        :class="
                            currentLocale === 'fr'
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-ink-muted'
                        "
                        @click="setLocale('fr')"
                    >
                        FR
                    </button>
                </div>
            </div>

            <div class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-ink-muted">
                    <span
                        aria-hidden="true"
                        class="inline-block size-3.5 bg-current"
                        :style="appearanceIconStyle"
                    ></span>
                    {{ t('Appearance') }}
                </span>
                <div
                    class="flex items-center gap-1 rounded-full bg-sand-100/70 p-0.5"
                >
                    <button
                        class="rounded-full px-3 py-1 transition"
                        :class="
                            currentAppearance === 'system'
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-ink-muted'
                        "
                        @click="setAppearance('system')"
                    >
                        {{ t('Auto') }}
                    </button>
                    <button
                        class="rounded-full px-3 py-1 transition"
                        :class="
                            currentAppearance === 'light'
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-ink-muted'
                        "
                        @click="setAppearance('light')"
                    >
                        {{ t('Light') }}
                    </button>
                    <button
                        class="rounded-full px-3 py-1 transition"
                        :class="
                            currentAppearance === 'dark'
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-ink-muted'
                        "
                        @click="setAppearance('dark')"
                    >
                        {{ t('Dark') }}
                    </button>
                </div>
            </div>

            <div class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-ink-muted">
                    <span
                        aria-hidden="true"
                        class="inline-block size-3.5 bg-current"
                        :style="feedLayoutIconStyle"
                    ></span>
                    {{ t('Feed view') }}
                </span>
                <div
                    class="flex items-center gap-1 rounded-full bg-sand-100/70 p-0.5"
                >
                    <button
                        class="rounded-full px-3 py-1 transition"
                        :class="
                            currentFeedLayout === 'masonry'
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-ink-muted'
                        "
                        @click="setFeedLayout('masonry')"
                    >
                        {{ t('Grid') }}
                    </button>
                    <button
                        class="rounded-full px-3 py-1 transition"
                        :class="
                            currentFeedLayout === 'list'
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-ink-muted'
                        "
                        @click="setFeedLayout('list')"
                    >
                        {{ t('Classic') }}
                    </button>
                </div>
            </div>
        </div>
    </SurfaceCard>
</template>
