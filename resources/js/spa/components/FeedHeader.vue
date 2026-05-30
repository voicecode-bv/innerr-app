<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useFeedLayout } from '@/spa/composables/useFeedLayout';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useCirclesStore } from '@/spa/stores/circles';
import { useFeedFilterStore } from '@/spa/stores/feedFilter';
import { useNotificationsStore } from '@/spa/stores/notifications';
import bugIcon from '../../../svg/doodle-icons/bug.svg';
import listIcon from '../../../svg/doodle-icons/feed-list.svg';
import masonryIcon from '../../../svg/doodle-icons/feed-masonry.svg';
import filterIcon from '../../../svg/doodle-icons/filter.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import searchIcon from '../../../svg/doodle-icons/search.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

const props = defineProps<{
    layout: 'list' | 'grid';
}>();

const { t } = useTranslations();
const router = useRouter();
const circlesStore = useCirclesStore();
const feedFilter = useFeedFilterStore();
const notificationsStore = useNotificationsStore();
const { setLayout } = useFeedLayout();

// Debug page is only registered outside production (see router).
const isLocalEnv =
    (import.meta.env.VITE_APP_ENV ?? 'production') !== 'production';

const circles = computed(() => circlesStore.items);

const unreadNotifications = computed(() => notificationsStore.unreadCount);
const unreadBadge = computed(() =>
    unreadNotifications.value > 99 ? '99+' : String(unreadNotifications.value),
);

function openFilterFlow(): void {
    feedFilter.reset();
    router.push({ name: 'spa.feed-filter.persons' });
}

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
        class="fixed right-[var(--inset-right)] left-[var(--inset-left)] z-100 border-b border-dark-sand bg-sand pt-[var(--inset-top)]"
    >
        <div class="flex items-center justify-between px-4 pt-2 pb-2">
            <RouterLink
                :to="{ name: 'spa.search' }"
                :aria-label="t('Search people')"
                data-tour="feed.search"
                class="flex size-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6 bg-ink"
                    :style="iconMaskStyle(searchIcon)"
                ></span>
            </RouterLink>
            <button
                type="button"
                :aria-label="t('Filter feed')"
                data-tour="feed.filter"
                class="flex size-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
                @click="openFilterFlow"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6 bg-ink"
                    :style="iconMaskStyle(filterIcon)"
                ></span>
            </button>
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
            <RouterLink
                v-if="isLocalEnv"
                :to="{ name: 'spa.dev.debug' }"
                aria-label="Debug tools (local only)"
                class="flex size-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
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
                class="relative flex size-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-sand-100"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6"
                    :class="
                        unreadNotifications > 0 ? 'bg-brand-orange' : 'bg-ink'
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
        <div
            data-tour="feed.circles-strip"
            class="no-scrollbar flex gap-3 overflow-x-auto border-t border-dark-sand px-4 pt-3 pb-3"
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
                    <div class="size-15 animate-pulse rounded-full bg-sand" />
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
                <span class="max-w-16 truncate text-sm font-medium text-ink">{{
                    circle.name
                }}</span>
            </RouterLink>
        </div>
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
