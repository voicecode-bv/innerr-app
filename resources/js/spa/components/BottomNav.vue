<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from 'vue';
import { useBottomNav } from '@/spa/composables/useBottomNav';
import type { BottomNavTab } from '@/spa/composables/useBottomNav';
import { useTranslations } from '@/spa/composables/useTranslations';
import cameraIcon from '../../../svg/doodle-icons/camera.svg';
import circleIcon from '../../../svg/doodle-icons/circle.svg';
import homeIcon from '../../../svg/doodle-icons/home.svg';
import mapIcon from '../../../svg/doodle-icons/map.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const { activeTab, mapUrl, profileUrl, navigate } = useBottomNav();

type NavItem = {
    id: BottomNavTab;
    icon: string;
    label: string;
    to: string;
};

// Regular tabs flanking the centre FAB: Home + Circles on the left, Map +
// Profile on the right. The Map and Profile targets are context-aware (see
// useBottomNav), so they stay reactive.
const leftItems = computed<NavItem[]>(() => [
    { id: 'home', icon: homeIcon, label: t('Home'), to: '/' },
    { id: 'circles', icon: circleIcon, label: t('Circles'), to: '/circles' },
]);

const rightItems = computed<NavItem[]>(() => [
    { id: 'map', icon: mapIcon, label: t('Map'), to: mapUrl.value },
    {
        id: 'profile',
        icon: userIcon,
        label: t('Profile'),
        to: profileUrl.value,
    },
]);

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

// Single pill that slides between tabs. We measure the active tab's icon
// wrapper and position the absolutely-placed pill over it, letting a CSS
// transition animate the move. Refs are collected per tab id.
const iconRefs = new Map<BottomNavTab, HTMLElement>();

function setIconRef(id: BottomNavTab, el: Element | null): void {
    if (el) {
        iconRefs.set(id, el as HTMLElement);
    } else {
        iconRefs.delete(id);
    }
}

const pillStyle = ref<Record<string, string>>({ opacity: '0' });

function updatePill(): void {
    const el = iconRefs.get(activeTab.value);

    if (!el) {
        // No active tab (e.g. notifications, settings): keep the pill hidden.
        pillStyle.value = { ...pillStyle.value, opacity: '0' };

        return;
    }

    pillStyle.value = {
        opacity: '1',
        left: `${el.offsetLeft}px`,
        top: `${el.offsetTop}px`,
        width: `${el.offsetWidth}px`,
        height: `${el.offsetHeight}px`,
    };
}

watch(activeTab, () => {
    void nextTick(updatePill);
});

onMounted(() => {
    void nextTick(updatePill);
    window.addEventListener('resize', updatePill);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', updatePill);
});
</script>

<template>
    <nav
        :aria-label="t('Main navigation')"
        class="fixed right-[var(--inset-right,0)] bottom-0 left-[var(--inset-left,0)] z-50 border-t border-dark-sand bg-sand pb-[var(--inset-bottom,0px)]"
    >
        <div
            class="relative mx-auto flex h-[var(--bottom-nav-height)] max-w-md items-stretch justify-between px-2"
        >
            <!-- Single sliding pill: positioned over the active tab's icon and
            animated between tabs via the CSS transition. -->
            <span
                aria-hidden="true"
                class="pointer-events-none absolute z-0 rounded-2xl bg-accent/10 ring-1 ring-accent/15 transition-all duration-300 ease-out dark:bg-accent-soft/15 dark:ring-accent-soft/25"
                :style="pillStyle"
            />
            <button
                v-for="item in leftItems"
                :key="item.id"
                type="button"
                class="flex flex-1 flex-col items-center justify-center gap-1 transition-opacity active:opacity-60"
                :aria-current="activeTab === item.id ? 'page' : undefined"
                @click="navigate(item.to)"
            >
                <span
                    :ref="(el) => setIconRef(item.id, el as Element | null)"
                    class="relative z-10 flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-6 bg-ink"
                        :style="iconMaskStyle(item.icon)"
                    />
                    <span
                        class="text-[0.6875rem] leading-none font-medium text-ink"
                    >
                        {{ item.label }}
                    </span>
                </span>
            </button>

            <!-- Centre FAB: raised, brand-blue, lifts above the bar. -->
            <div class="flex w-16 shrink-0 justify-center">
                <button
                    type="button"
                    class="-mt-5 flex size-15 flex-col items-center justify-center rounded-full bg-accent shadow-lg ring-4 shadow-accent/30 ring-sand transition-transform active:scale-95"
                    :aria-label="t('New')"
                    @click="navigate('/posts/create')"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-7 bg-brand-sand"
                        :style="iconMaskStyle(cameraIcon)"
                    />
                </button>
            </div>

            <button
                v-for="item in rightItems"
                :key="item.id"
                type="button"
                class="flex flex-1 flex-col items-center justify-center gap-1 transition-opacity active:opacity-60"
                :aria-current="activeTab === item.id ? 'page' : undefined"
                @click="navigate(item.to)"
            >
                <span
                    :ref="(el) => setIconRef(item.id, el as Element | null)"
                    class="relative z-10 flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-6 bg-ink"
                        :style="iconMaskStyle(item.icon)"
                    />
                    <span
                        class="text-[0.6875rem] leading-none font-medium text-ink"
                    >
                        {{ item.label }}
                    </span>
                </span>
            </button>
        </div>
    </nav>
</template>
