<script setup lang="ts">
import { Dialog, Events, Off, On } from '@nativephp/mobile';
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { RouterLink } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { useTranslations } from '@/spa/composables/useTranslations';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useAuthStore } from '@/spa/stores/auth';
import { useFeatureTourStore } from '@/spa/stores/featureTour';
import bellIcon from '../../../../svg/doodle-icons/bell.svg';
import circleIcon from '../../../../svg/doodle-icons/circle.svg';
import cloudIcon from '../../../../svg/doodle-icons/cloud.svg';
import crownIcon from '../../../../svg/doodle-icons/crown.svg';
import foldedHandsIcon from '../../../../svg/doodle-icons/folded-hands.svg';
import headphoneIcon from '../../../../svg/doodle-icons/headphone.svg';
import lockIcon from '../../../../svg/doodle-icons/lock.svg';
import questionIcon from '../../../../svg/doodle-icons/question.svg';
import tagIcon from '../../../../svg/doodle-icons/tag.svg';
import usersIcon from '../../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const auth = useAuthStore();
const featureTour = useFeatureTourStore();
const router = useRouter();
const { isIos, isAndroid } = usePlatform();

const menuItems = computed(() => [
    {
        routeName: 'spa.settings.default-circles',
        icon: circleIcon,
        label: 'Default circles',
        tone: 'green' as const,
    },
    {
        routeName: 'spa.settings.persons',
        icon: usersIcon,
        label: 'Persons',
        tone: 'yellow' as const,
    },
    {
        routeName: 'spa.settings.tags',
        icon: tagIcon,
        label: 'Tags',
        tone: 'teal' as const,
    },
    {
        routeName: 'spa.settings.notifications',
        icon: bellIcon,
        label: 'Push notifications',
        tone: 'teal' as const,
    },
    {
        routeName: 'spa.settings.give',
        icon: foldedHandsIcon,
        label: 'Inner Gives',
        tone: 'orange' as const,
    },
    {
        routeName: 'spa.settings.storage',
        icon: cloudIcon,
        label: 'Storage',
        tone: 'green' as const,
    },
    ...(isIos.value || isAndroid.value
        ? [
              {
                  routeName: 'spa.settings.subscriptions',
                  icon: crownIcon,
                  label: 'Subscription',
                  tone: 'yellow' as const,
              },
          ]
        : []),
    {
        routeName: 'spa.settings.account',
        icon: lockIcon,
        label: 'Account',
        tone: 'green' as const,
    },
    {
        routeName: 'spa.settings.support',
        icon: headphoneIcon,
        label: 'Support',
        tone: 'teal' as const,
    },
]);

function restartTour(): void {
    featureTour.restart();
    router.push({ name: 'spa.home' });
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
                <ul class="divide-y divide-sand-100 bg-surface">
                    <li
                        v-for="item in menuItems"
                        :key="item.routeName"
                        class="reveal-item"
                    >
                        <RouterLink
                            :to="{ name: item.routeName }"
                            class="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-sand-50"
                        >
                            <IconTile
                                :icon="item.icon"
                                size="xs"
                                :tone="item.tone"
                                class="shrink-0"
                            />
                            <span
                                class="flex-1 text-base leading-snug font-semibold text-ink"
                            >
                                {{ t(item.label) }}
                            </span>
                        </RouterLink>
                    </li>
                    <li class="reveal-item">
                        <button
                            type="button"
                            class="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-sand-50"
                            @click="restartTour"
                        >
                            <IconTile
                                :icon="questionIcon"
                                size="xs"
                                tone="teal"
                                class="shrink-0"
                            />
                            <span
                                class="flex-1 text-base leading-snug font-semibold text-ink"
                            >
                                {{ t('Replay tour') }}
                            </span>
                        </button>
                    </li>
                </ul>

                <Button variant="danger" size="lg" block @click="logout">
                    {{ t('Log out') }}
                </Button>

                <p
                    v-if="auth.appVersion"
                    class="text-center text-xs text-ink/40"
                >
                    {{ t('Version :version', { version: auth.appVersion }) }}
                </p>
            </div>
        </div>
    </AppLayout>
</template>
