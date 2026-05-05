<script setup lang="ts">
import { Dialog, Events, Off, On } from '@nativephp/mobile';
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import ListItem from '@/spa/components/ListItem.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { useTranslations } from '@/spa/composables/useTranslations';
import { api } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useAuthStore } from '@/spa/stores/auth';
import { useI18nStore } from '@/spa/stores/i18n';
import bellIcon from '../../../../svg/doodle-icons/bell.svg';
import circleIcon from '../../../../svg/doodle-icons/circle.svg';
import cloudIcon from '../../../../svg/doodle-icons/cloud.svg';
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

const menuItems = computed(() => [
    {
        routeName: 'spa.settings.edit-profile',
        icon: pencilIcon,
        label: 'Edit profile',
    },
    {
        routeName: 'spa.settings.default-circles',
        icon: circleIcon,
        label: 'Default circles',
    },
    { routeName: 'spa.settings.persons', icon: usersIcon, label: 'Persons' },
    { routeName: 'spa.settings.tags', icon: tagIcon, label: 'Tags' },
    {
        routeName: 'spa.settings.notifications',
        icon: bellIcon,
        label: 'Push notifications',
    },
    {
        routeName: 'spa.settings.give',
        icon: foldedHandsIcon,
        label: 'Inner Gives',
    },
    {
        routeName: 'spa.settings.storage',
        icon: cloudIcon,
        label: 'Storage',
    },
    ...(isIos.value || isAndroid.value
        ? [
              {
                  routeName: 'spa.settings.subscriptions',
                  icon: crownIcon,
                  label: 'Subscription',
              },
          ]
        : []),
    { routeName: 'spa.settings.account', icon: lockIcon, label: 'Account' },
]);

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

    // Forceer een Edge bottom-nav re-render in de nieuwe taal. Anders ververst
    // de native bar pas bij de volgende route-navigatie (router.afterEach).
    api.post('/api/spa/edge/active-tab', {
        path: router.currentRoute.value.path,
    }).catch(() => {
        // Fire-and-forget: bij netwerkfout ververst de bar bij de volgende navigatie.
    });
}

async function logout(): Promise<void> {
    await Dialog.alert()
        .confirm(t('Log out'), t('Are you sure you want to log out?'))
        .id('logout-confirm');
}

async function handleButtonPressed(payload: {
    index: number;
    label: string;
    id?: string | null;
}): Promise<void> {
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
        <div
            class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]"
        >
            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <div class="flex items-center justify-between gap-3 px-2">
                    <span
                        class="flex items-center gap-2 text-sand-500 dark:text-sand-400"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-3.5 bg-current"
                            :style="languageIconStyle"
                        ></span>
                        {{ t('Language') }}
                    </span>
                    <div
                        class="flex items-center gap-1 rounded-full bg-sand-100/70 p-0.5 dark:bg-sand-800/60"
                    >
                        <button
                            class="rounded-full px-3 py-1 transition"
                            :class="
                                currentLocale === 'nl'
                                    ? 'bg-white text-teal shadow-sm dark:bg-sand-900 dark:text-sand-100'
                                    : 'text-sand-500 dark:text-sand-400'
                            "
                            @click="setLocale('nl')"
                        >
                            NL
                        </button>
                        <button
                            class="rounded-full px-3 py-1 transition"
                            :class="
                                currentLocale === 'en'
                                    ? 'bg-white text-teal shadow-sm dark:bg-sand-900 dark:text-sand-100'
                                    : 'text-sand-500 dark:text-sand-400'
                            "
                            @click="setLocale('en')"
                        >
                            EN
                        </button>
                    </div>
                </div>

                <ul
                    class="divide-y divide-sand-100 overflow-hidden rounded-lg dark:divide-sand-700/60"
                >
                    <li
                        v-for="item in menuItems"
                        :key="item.routeName"
                        class="reveal-item"
                    >
                        <ListItem :to="{ name: item.routeName }">
                            <template #leading>
                                <IconTile
                                    :icon="item.icon"
                                    size="sm"
                                    tone="sage"
                                />
                            </template>
                            {{ t(item.label) }}
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
