<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AnimatedCount from '@/components/AnimatedCount.vue';
import AppPreferences from '@/spa/components/AppPreferences.vue';
import ChildTimelineMenu from '@/spa/components/ChildTimelineMenu.vue';
import Drawer from '@/spa/components/Drawer.vue';
import SettingsMenu from '@/spa/components/SettingsMenu.vue';
import { useFeedLayout } from '@/spa/composables/useFeedLayout';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAuthStore } from '@/spa/stores/auth';
import { useNotificationsStore } from '@/spa/stores/notifications';
import bugIcon from '../../../svg/doodle-icons/bug.svg';
import listIcon from '../../../svg/doodle-icons/feed-list.svg';
import masonryIcon from '../../../svg/doodle-icons/feed-masonry.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import menuIcon from '../../../svg/doodle-icons/menu.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';
import innerrLogoDark from '../../../svg/innerr-logo-on-blue.svg';
import innerrLogo from '../../../svg/innerr-logo-on-sand.svg';

const props = defineProps<{
    layout: 'list' | 'grid';
    /** Translucent blur treatment while content is scrolled underneath. */
    elevated?: boolean;
}>();

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();
const notificationsStore = useNotificationsStore();
const { setLayout } = useFeedLayout();

const isDrawerOpen = ref(false);

const firstName = computed(() => (auth.user?.name ?? '').split(' ')[0] ?? '');

// Quick link to the debug page during local development. The page itself is
// always registered (also reachable via the hidden login-logo gesture); this
// shortcut only shows on local/dev so it never clutters the production UI.
// Honours the Vite dev server too, so it appears under `npm run dev` even when
// VITE_APP_ENV is left at production.
const isLocalEnv =
    import.meta.env.DEV ||
    (import.meta.env.VITE_APP_ENV ?? 'production') !== 'production';

const unreadNotifications = computed(() => notificationsStore.unreadCount);
const unreadBadge = computed(() =>
    unreadNotifications.value > 99 ? '99+' : String(unreadNotifications.value),
);

// Toggle between the list feed and the masonry grid. This persists the choice
// as the user's preference (so it sticks on the next Home visit) and navigates
// to the matching route; the shared feed cache means neither view refetches.
function toggleLayout(): void {
    const next = props.layout === 'list' ? 'masonry' : 'list';

    // setLayout applies the local preference synchronously before its network
    // call, so the route guard already sees the new value on push.
    void setLayout(next);
    router.push({
        name: next === 'masonry' ? 'spa.home.grid' : 'spa.home',
    });
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
        data-feed-header
        class="fixed right-[var(--inset-right)] left-[var(--inset-left)] z-100 border-b border-dark-sand pt-[var(--inset-top)] transition-[background-color] duration-300 motion-reduce:transition-none"
        :class="elevated ? 'bg-sand/85 backdrop-blur-md' : 'bg-sand'"
    >
        <div class="px-4 pt-3 pb-3">
            <div class="flex items-center gap-3">
                <div class="flex flex-1 items-center">
                    <button
                        type="button"
                        :aria-label="t('Open menu')"
                        data-tour="feed.menu"
                        class="-my-1 flex size-11 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
                        @click="isDrawerOpen = true"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 bg-ink"
                            :style="iconMaskStyle(menuIcon)"
                        ></span>
                    </button>
                </div>
                <img
                    :src="innerrLogo"
                    :alt="t('Innerr')"
                    class="h-9 w-auto shrink-0 dark:hidden"
                />
                <img
                    :src="innerrLogoDark"
                    :alt="t('Innerr')"
                    class="hidden h-7 w-auto shrink-0 dark:block"
                />
                <div class="flex flex-1 items-center justify-end gap-1">
                    <RouterLink
                        v-if="isLocalEnv"
                        :to="{ name: 'spa.dev.debug' }"
                        aria-label="Debug tools (local only)"
                        class="-my-1 flex size-11 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 bg-ink"
                            :style="iconMaskStyle(bugIcon)"
                        ></span>
                    </RouterLink>
                    <RouterLink
                        :to="{ name: 'spa.notifications' }"
                        :aria-label="
                            unreadNotifications > 0
                                ? t(':count unread notifications', {
                                      count: unreadNotifications,
                                  })
                                : t('Open notifications')
                        "
                        data-tour="feed.notifications"
                        class="relative -my-1 flex size-11 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6"
                            :class="
                                unreadNotifications > 0
                                    ? 'bg-brand-orange'
                                    : 'bg-ink'
                            "
                            :style="
                                iconMaskStyle(
                                    unreadNotifications > 0
                                        ? heartFilledIcon
                                        : heartIcon,
                                )
                            "
                        ></span>
                        <span
                            v-if="unreadNotifications > 0"
                            class="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-white shadow-sm ring-2 ring-white"
                        >
                            <AnimatedCount :value="unreadBadge" />
                        </span>
                    </RouterLink>
                </div>
            </div>
        </div>

        <div
            class="flex items-center justify-between border-t border-dark-sand px-4 py-2 pb-2"
        >
            <ChildTimelineMenu />
            <button
                type="button"
                :aria-label="
                    layout === 'list'
                        ? t('Switch to grid view')
                        : t('Switch to list view')
                "
                data-tour="feed.layout-toggle"
                class="-my-1 flex size-11 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
                @click="toggleLayout"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6 bg-ink"
                    :style="
                        iconMaskStyle(
                            layout === 'list' ? masonryIcon : listIcon,
                        )
                    "
                ></span>
            </button>
        </div>

        <Drawer :open="isDrawerOpen" @update:open="isDrawerOpen = $event">
            <!-- Album-note atmosphere: a soft glow behind the greeting plus
                 film grain over the whole panel. -->
            <div
                aria-hidden="true"
                class="pointer-events-none absolute inset-0 overflow-hidden"
            >
                <div
                    class="absolute -top-16 -right-12 size-48 rounded-full bg-brand-yellow/20 blur-3xl"
                ></div>
                <div
                    class="absolute -bottom-20 -left-16 size-56 rounded-full bg-accent-soft/15 blur-3xl"
                ></div>
                <div class="absolute inset-0 grain opacity-[0.035]"></div>
            </div>

            <!-- Personal greeting: this drawer is *your* album, so it opens
                 with you instead of repeating the wordmark from the header. -->
            <div class="relative flex items-center gap-4 px-5 pt-6 pb-5">
                <img
                    v-if="auth.user?.avatar"
                    :src="auth.user.avatar"
                    :alt="auth.user.name"
                    class="avatar-ring size-14 shrink-0 rounded-full object-cover"
                />
                <span
                    v-else
                    class="avatar-ring flex size-14 shrink-0 items-center justify-center rounded-full"
                >
                    <span
                        class="flex size-full items-center justify-center rounded-full bg-brand-blue text-brand-sand"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 bg-current"
                            :style="iconMaskStyle(userIcon)"
                        ></span>
                    </span>
                </span>
                <div class="min-w-0 flex-1">
                    <p
                        class="truncate text-2xl font-extrabold tracking-tight text-ink"
                    >
                        {{ t('Hi :name', { name: firstName }) }}
                    </p>
                    <p
                        v-if="auth.user?.username"
                        class="truncate text-sm text-ink-muted"
                    >
                        @{{ auth.user.username }}
                    </p>
                </div>
            </div>

            <div class="relative flex-1 space-y-4 overflow-y-auto px-4 pb-4">
                <AppPreferences />
                <SettingsMenu @navigate="isDrawerOpen = false" />
            </div>
        </Drawer>
    </div>
</template>
