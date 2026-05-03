<script setup lang="ts">
import { Dialog, Events, Off, On } from '@nativephp/mobile';
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import ListItem from '@/spa/components/ListItem.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useAuthStore } from '@/spa/stores/auth';
import { useI18nStore } from '@/spa/stores/i18n';
import bellIcon from '../../../../svg/doodle-icons/bell.svg';
import circleIcon from '../../../../svg/doodle-icons/circle.svg';
import crownIcon from '../../../../svg/doodle-icons/crown.svg';
import foldedHandsIcon from '../../../../svg/doodle-icons/folded-hands.svg';
import globeIcon from '../../../../svg/doodle-icons/globe.svg';
import lockIcon from '../../../../svg/doodle-icons/lock.svg';
import pencilIcon from '../../../../svg/doodle-icons/pencil-3.svg';
import tagIcon from '../../../../svg/doodle-icons/tag.svg';
import usersIcon from '../../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const i18n = useI18nStore();
const auth = useAuthStore();
const router = useRouter();
const { isIos, isAndroid } = usePlatform();

const currentLocale = computed(() => i18n.locale);

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

async function logout(): Promise<void> {
    await Dialog.alert()
        .confirm(t('Log out'), t('Are you sure you want to log out?'))
        .id('logout-confirm');
}

async function handleButtonPressed(payload: { index: number; label: string; id?: string | null }): Promise<void> {
    if (payload.id === 'logout-confirm' && payload.index === 1) {
        await auth.logout();
        router.push({ name: 'spa.login' });
    }
}

onMounted(() => On(Events.Alert.ButtonPressed, handleButtonPressed));
onUnmounted(() => Off(Events.Alert.ButtonPressed, handleButtonPressed));
</script>

<template>
    <AppLayout :title="t('Settings')">
        <div class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]">
            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <div class="flex items-center justify-between gap-3 px-2">
                    <span class="flex items-center gap-2 text-xs font-medium text-sand-500 dark:text-sand-400">
                        <span aria-hidden="true" class="inline-block size-3.5 bg-current" :style="languageIconStyle"></span>
                        {{ t('Language') }}
                    </span>
                    <div class="flex items-center gap-1 rounded-full bg-sand-100/70 p-0.5 text-xs font-medium dark:bg-sand-800/60">
                        <button
                            class="rounded-full px-3 py-1 transition"
                            :class="currentLocale === 'nl' ? 'bg-white text-teal shadow-sm dark:bg-sand-900 dark:text-sand-100' : 'text-sand-500 dark:text-sand-400'"
                            @click="setLocale('nl')"
                        >
                            NL
                        </button>
                        <button
                            class="rounded-full px-3 py-1 transition"
                            :class="currentLocale === 'en' ? 'bg-white text-teal shadow-sm dark:bg-sand-900 dark:text-sand-100' : 'text-sand-500 dark:text-sand-400'"
                            @click="setLocale('en')"
                        >
                            EN
                        </button>
                    </div>
                </div>

                <ul class="divide-y divide-sand-100 overflow-hidden rounded-lg dark:divide-sand-700/60">
                    <li>
                        <ListItem :to="{ name: 'spa.settings.edit-profile' }">
                            <template #leading><IconTile :icon="pencilIcon" size="sm" tone="sage" /></template>
                            {{ t('Edit profile') }}
                        </ListItem>
                    </li>
                    <li>
                        <ListItem :to="{ name: 'spa.settings.default-circles' }">
                            <template #leading><IconTile :icon="circleIcon" size="sm" tone="sage" /></template>
                            {{ t('Default circles') }}
                        </ListItem>
                    </li>
                    <li>
                        <ListItem :to="{ name: 'spa.settings.persons' }">
                            <template #leading><IconTile :icon="usersIcon" size="sm" tone="sage" /></template>
                            {{ t('Persons') }}
                        </ListItem>
                    </li>
                    <li>
                        <ListItem :to="{ name: 'spa.settings.tags' }">
                            <template #leading><IconTile :icon="tagIcon" size="sm" tone="sage" /></template>
                            {{ t('Tags') }}
                        </ListItem>
                    </li>
                    <li>
                        <ListItem :to="{ name: 'spa.settings.notifications' }">
                            <template #leading><IconTile :icon="bellIcon" size="sm" tone="sage" /></template>
                            {{ t('Push notifications') }}
                        </ListItem>
                    </li>
                    <li>
                        <ListItem :to="{ name: 'spa.settings.give' }">
                            <template #leading><IconTile :icon="foldedHandsIcon" size="sm" tone="sage" /></template>
                            {{ t('Inner Gives') }}
                        </ListItem>
                    </li>
                    <li v-if="isIos">
                        <ListItem :to="{ name: 'spa.settings.apple-subscriptions' }">
                            <template #leading><IconTile :icon="crownIcon" size="sm" tone="sage" /></template>
                            {{ t('Subscription') }}
                        </ListItem>
                    </li>
                    <li v-if="isAndroid">
                        <ListItem :to="{ name: 'spa.settings.google-subscriptions' }">
                            <template #leading><IconTile :icon="crownIcon" size="sm" tone="sage" /></template>
                            {{ t('Subscription') }}
                        </ListItem>
                    </li>
                    <li>
                        <ListItem :to="{ name: 'spa.settings.account' }">
                            <template #leading><IconTile :icon="lockIcon" size="sm" tone="sage" /></template>
                            {{ t('Account') }}
                        </ListItem>
                    </li>
                </ul>

                <Button variant="danger" size="lg" block @click="logout">
                    {{ t('Log out') }}
                </Button>
            </div>
        </div>
    </AppLayout>
</template>
