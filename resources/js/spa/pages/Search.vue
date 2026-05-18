<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import {
    useInfiniteScroll
    
} from '@/spa/composables/useInfiniteScroll';
import type {PaginatedResponse} from '@/spa/composables/useInfiniteScroll';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import searchIcon from '../../../svg/doodle-icons/search.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

interface SearchUser {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
}

const { t } = useTranslations();
const router = useRouter();

const query = ref('');
const activeTerm = ref('');

const inputRef = useTemplateRef<HTMLInputElement>('input');
const sentinelRef = ref<HTMLElement | null>(null);

async function fetchUsers(
    page: number,
): Promise<PaginatedResponse<SearchUser>> {
    const params = new URLSearchParams({ page: String(page) });

    if (activeTerm.value !== '') {
        params.set('q', activeTerm.value);
    }

    return externalApi.get<PaginatedResponse<SearchUser>>(
        `/users/search?${params.toString()}`,
    );
}

const feed = useInfiniteScroll<SearchUser>(fetchUsers, sentinelRef);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function clearDebounce(): void {
    if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

watch(query, (next) => {
    clearDebounce();
    const term = next.trim();

    if (term === activeTerm.value) {
        return;
    }

    debounceTimer = setTimeout(() => {
        activeTerm.value = term;
        void feed.reset();
    }, 250);
});

function clearQuery(): void {
    query.value = '';
    inputRef.value?.focus();
}

function goBack(): void {
    if (window.history.length > 1) {
        router.back();
    } else {
        router.push({ name: 'spa.home' });
    }
}

onMounted(() => {
    inputRef.value?.focus();
});

onUnmounted(clearDebounce);

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
    <AppLayout :title="t('Search people')">
        <template #header-left>
            <button
                class="flex items-center text-teal"
                :aria-label="t('Back')"
                @click="goBack"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>
        </template>

        <div class="mt-14 px-4 pt-4 pb-24">
            <label class="relative block">
                <span class="sr-only">{{ t('Search people') }}</span>
                <span
                    aria-hidden="true"
                    class="pointer-events-none absolute top-1/2 left-5 z-10 inline-block size-5 -translate-y-1/2 bg-teal-muted"
                    :style="iconMaskStyle(searchIcon)"
                ></span>
                <input
                    ref="input"
                    v-model="query"
                    type="search"
                    inputmode="search"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    enterkeyhint="search"
                    :placeholder="t('Search by name, username, or email')"
                    class="field !pr-14 !pl-13"
                />
                <button
                    v-if="query.length > 0"
                    type="button"
                    class="absolute top-1/2 right-4 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-teal-muted transition-colors hover:bg-sand-100"
                    :aria-label="t('Clear search')"
                    @click="clearQuery"
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
            </label>

            <ul v-if="feed.items.length > 0" class="mt-4">
                <li
                    v-for="user in feed.items"
                    :key="user.id"
                    class="border-b border-sand-50"
                >
                    <RouterLink
                        :to="{
                            name: 'spa.profiles.show',
                            params: { username: user.username },
                        }"
                        class="flex items-center gap-3 py-3"
                    >
                        <img
                            v-if="user.avatar"
                            :src="user.avatar"
                            :alt="user.name"
                            class="avatar-ring size-11 rounded-full bg-sand-200 object-cover"
                            loading="lazy"
                            decoding="async"
                        />
                        <div
                            v-else
                            class="flex size-11 items-center justify-center rounded-full bg-sage-100"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-6 bg-teal"
                                :style="iconMaskStyle(userIcon)"
                            ></span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-semibold text-teal">
                                {{ user.name }}
                            </p>
                            <p class="truncate text-teal-muted">
                                @{{ user.username }}
                            </p>
                        </div>
                    </RouterLink>
                </li>
            </ul>

            <ul v-else-if="feed.loading" class="mt-4">
                <li
                    v-for="n in 6"
                    :key="n"
                    class="flex items-center gap-3 border-b border-sand-50 py-3"
                >
                    <div
                        class="size-11 shrink-0 animate-pulse rounded-full bg-sand-200"
                    />
                    <div class="min-w-0 flex-1 space-y-2">
                        <div
                            class="h-3.5 animate-pulse rounded bg-sand-200"
                            :style="{ width: `${50 + n * 5}%` }"
                        />
                        <div
                            class="h-3 w-24 animate-pulse rounded bg-sand-200/70"
                        />
                    </div>
                </li>
            </ul>

            <div v-else-if="feed.error" class="px-4 py-10 text-center">
                <p class="text-blush-500">{{ t('Could not search') }}</p>
                <button class="mt-2 text-teal-muted" @click="feed.reset()">
                    {{ t('Try again') }}
                </button>
            </div>

            <div v-else-if="activeTerm !== ''" class="px-4 py-10 text-center">
                <p class="text-teal-muted">
                    {{ t('No people found') }}
                </p>
            </div>

            <div v-else class="px-4 py-10 text-center">
                <p class="text-night">
                    {{ t('Nobody in your circles yet') }}
                </p>
                <p class="mt-2 text-teal-muted">
                    {{ t('Invite people to your circles to see them here.') }}
                </p>
            </div>

            <div
                v-if="feed.loading && feed.items.length > 0"
                class="flex items-center justify-center gap-2 py-6 text-teal-muted"
            >
                {{ t('Loading more...') }}
            </div>

            <p
                v-if="feed.error && feed.items.length > 0"
                class="px-4 py-2 text-center text-blush-500"
            >
                {{ t('Could not search') }}
            </p>

            <div ref="sentinelRef" class="h-1" />
        </div>
    </AppLayout>
</template>
