<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import ChildTimelineMenu from '@/spa/components/ChildTimelineMenu.vue';
import Drawer from '@/spa/components/Drawer.vue';
import SettingsMenu from '@/spa/components/SettingsMenu.vue';
import { useFeedLayout } from '@/spa/composables/useFeedLayout';
import { useTranslations } from '@/spa/composables/useTranslations';
import type { Circle } from '@/spa/stores/circles';
import { sortByRecentlyUpdated, useCirclesStore } from '@/spa/stores/circles';
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
}>();

const { t } = useTranslations();
const router = useRouter();
const circlesStore = useCirclesStore();
const notificationsStore = useNotificationsStore();
const { setLayout } = useFeedLayout();

const isDrawerOpen = ref(false);

// Quick link to the debug page during local development. The page itself is
// always registered (also reachable via the hidden login-logo gesture); this
// shortcut only shows on local/dev so it never clutters the production UI.
// Honours the Vite dev server too, so it appears under `npm run dev` even when
// VITE_APP_ENV is left at production.
const isLocalEnv =
    import.meta.env.DEV ||
    (import.meta.env.VITE_APP_ENV ?? 'production') !== 'production';

// The strip shows circles with the most recently changed on top. We sort a copy
// client-side (circles per user are few) so the shared store and its other
// consumers keep their own ordering.
const circles = computed<Circle[] | null>(() =>
    circlesStore.items ? sortByRecentlyUpdated(circlesStore.items) : null,
);

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
        class="fixed right-[var(--inset-right)] left-[var(--inset-left)] z-100 border-b border-dark-sand bg-sand pt-[var(--inset-top)]"
    >
        <div class="px-4 pt-3 pb-3">
            <div class="mb-6 flex items-center gap-3">
                <div class="flex flex-1 items-center">
                    <button
                        type="button"
                        :aria-label="t('Open menu')"
                        class="flex size-9 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
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
                    class="h-7 w-auto shrink-0 dark:hidden"
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
                        class="flex size-9 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
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
                        class="relative flex size-9 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
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
                            class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-display text-[10px] leading-none font-semibold text-white shadow-sm ring-2 ring-white"
                        >
                            {{ unreadBadge }}
                        </span>
                    </RouterLink>
                </div>
            </div>
            <div
                data-tour="feed.circles-strip"
                class="-mx-4 px-4 no-scrollbar flex gap-3 overflow-x-auto"
            >
                <RouterLink
                    :to="{ name: 'spa.circles.index' }"
                    class="group flex shrink-0 flex-col items-center gap-1.5"
                >
                    <div
                        class="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-ink/50 transition-transform duration-500 group-hover:rotate-90"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="size-6 text-ink"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 4.5v15m7.5-7.5h-15"
                            />
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-ink">{{
                        t('Circles')
                    }}</span>
                </RouterLink>

                <template v-if="!circles">
                    <div
                        v-for="n in 4"
                        :key="n"
                        class="flex shrink-0 flex-col items-center gap-1.5"
                    >
                        <div
                            class="size-15 animate-pulse rounded-full bg-sand"
                        />
                        <div class="h-3 w-12 animate-pulse rounded bg-sand" />
                    </div>
                </template>

                <RouterLink
                    v-else
                    v-for="circle in circles"
                    :key="circle.id"
                    :to="{
                        name: 'spa.circles.feed',
                        params: { circle: circle.id },
                    }"
                    class="flex shrink-0 flex-col items-center gap-1.5"
                >
                    <div class="circle-ring relative rounded-full p-0.5">
                        <div class="rounded-full bg-surface p-0.5">
                            <img
                                v-if="circle.photo"
                                :src="circle.photo"
                                :alt="circle.name"
                                class="size-14 rounded-full object-cover"
                            />
                            <div
                                v-else
                                class="flex size-14 items-center justify-center rounded-full bg-sand-100"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-7 bg-sand-600"
                                    :style="iconMaskStyle(userIcon)"
                                ></span>
                            </div>
                        </div>
                    </div>
                    <span
                        class="max-w-16 truncate text-sm font-medium text-ink"
                        >{{ circle.name }}</span
                    >
                </RouterLink>
            </div>
        </div>

        <div
            class="flex items-center justify-between border-t border-dark-sand px-4 pt-2 pb-2"
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
                class="flex size-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
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
            <div class="flex justify-center px-4 pt-4 pb-8">
                <img
                    :src="innerrLogo"
                    :alt="t('Innerr')"
                    class="h-7 w-auto dark:hidden"
                />
                <img
                    :src="innerrLogoDark"
                    :alt="t('Innerr')"
                    class="hidden h-7 w-auto dark:block"
                />
            </div>
            <div class="flex-1 overflow-y-auto px-4 pb-4">
                <SettingsMenu @navigate="isDrawerOpen = false" />
            </div>
        </Drawer>
    </div>
</template>

<style scoped>
/* circle-ring is aliased to the global .avatar-ring utility (in app.css) */
.circle-ring {
    background: conic-gradient(
        from 0deg,
        var(--color-brand-blue),
        var(--color-brand-green),
        var(--color-brand-yellow),
        var(--color-brand-orange),
        var(--color-brand-blue)
    );
}
</style>
