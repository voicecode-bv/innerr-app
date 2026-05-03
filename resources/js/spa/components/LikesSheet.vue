<script setup lang="ts">
import { onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { RouterLink } from 'vue-router';
import BottomSheet from '@/components/BottomSheet.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';

interface LikeUser {
    id: number;
    name: string;
    username: string;
    avatar: string | null;
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const props = defineProps<{
    open: boolean;
    postId: number;
    initialCount?: number;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const { t } = useTranslations();

const users = ref<LikeUser[]>([]);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const loadError = ref<string | null>(null);
const hasLoaded = ref(false);
const total = ref(props.initialCount ?? 0);
const currentPage = ref(0);
const lastPage = ref(1);

const sentinelRef = useTemplateRef<HTMLDivElement>('sentinel');
let observer: IntersectionObserver | null = null;
const seenIds = new Set<number>();

async function loadPage(page: number): Promise<void> {
    const isFirst = page === 1;
    if (isFirst) {
        isLoading.value = true;
    } else {
        isLoadingMore.value = true;
    }
    loadError.value = null;

    try {
        const result = await externalApi.get<{ data: LikeUser[]; meta: Meta }>(
            `/posts/${props.postId}/likes?page=${page}`,
        );

        const incoming = result.data.filter((u) => {
            if (seenIds.has(u.id)) return false;
            seenIds.add(u.id);
            return true;
        });

        users.value = isFirst ? incoming : [...users.value, ...incoming];
        currentPage.value = result.meta.current_page;
        lastPage.value = result.meta.last_page;
        total.value = result.meta.total;
        hasLoaded.value = true;
    } catch {
        loadError.value = t('Failed to load likes');
    } finally {
        isLoading.value = false;
        isLoadingMore.value = false;
    }
}

function loadMore(): void {
    if (
        isLoadingMore.value ||
        isLoading.value ||
        currentPage.value >= lastPage.value
    )
        return;
    void loadPage(currentPage.value + 1);
}

function attachObserver(target: HTMLElement): void {
    observer?.disconnect();
    observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                loadMore();
            }
        },
        { rootMargin: '200px' },
    );
    observer.observe(target);
}

function resetState(): void {
    users.value = [];
    seenIds.clear();
    hasLoaded.value = false;
    currentPage.value = 0;
    lastPage.value = 1;
    loadError.value = null;
}

// Eén gecombineerde watcher op (open, postId) lost meerdere bugs in één keer
// op:
// - `immediate: true` zorgt dat de eerste mount (parent gebruikt v-if =
// 'likesPostId !== null', dus het component bestaat nog niet vóór de
// eerste tap) direct een fetch start.
// - Als de gebruiker daarna een andere post opent verandert postId en/of
// open opnieuw — deze watcher vuurt dan opnieuw zonder dat een tweede
// losse postId-watcher dezelfde fetch dubbel triggert.
// - Sluiten (open: true → false) gaat netjes door de early-return.
watch(
    [() => props.open, () => props.postId],
    ([isOpen]) => {
        if (!isOpen) return;
        resetState();
        void loadPage(1);
    },
    { immediate: true },
);

watch(sentinelRef, (el) => {
    if (el) {
        attachObserver(el);
    } else {
        observer?.disconnect();
        observer = null;
    }
});

onUnmounted(() => {
    observer?.disconnect();
    observer = null;
});

function close(): void {
    emit('update:open', false);
}

function onSheetUpdate(value: boolean): void {
    if (!value) {
        close();
    } else {
        emit('update:open', true);
    }
}
</script>

<template>
    <BottomSheet :open="open" @update:open="onSheetUpdate">
        <template #header>
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-sand-700 dark:text-sand-300">
                    {{ t('Likes') }}
                    <span
                        v-if="total > 0"
                        class="font-normal text-sand-400 dark:text-sand-500"
                        >({{ total }})</span
                    >
                </h2>
                <button
                    class="text-sand-500 dark:text-sand-400"
                    :aria-label="t('Close')"
                    @click="close"
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
                            d="M6 18 18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </template>

        <div
            v-if="isLoading"
            class="flex items-center justify-center px-4 py-10 pb-24"
        >
            <svg
                class="size-6 animate-spin text-sand-400 dark:text-sand-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                />
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
        </div>

        <div
            v-else-if="loadError && users.length === 0"
            class="px-4 py-10 pb-24 text-center"
        >
            <p class="text-blush-500">{{ loadError }}</p>
            <button
                class="mt-2 text-sand-500 dark:text-sand-400"
                @click="loadPage(1)"
            >
                {{ t('Try again') }}
            </button>
        </div>

        <div
            v-else-if="hasLoaded && users.length === 0"
            class="px-4 py-10 pb-24 text-center"
        >
            <p class="text-sand-600 dark:text-sand-300">
                {{ t('No likes yet') }}
            </p>
        </div>

        <div v-else class="pb-24">
            <RouterLink
                v-for="user in users"
                :key="user.id"
                :to="{
                    name: 'spa.profiles.show',
                    params: { username: user.username },
                }"
                class="flex items-center gap-3 border-b border-sand-50 px-4 py-3 dark:border-sand-800"
                @click="close"
            >
                <img
                    :src="
                        user.avatar ??
                        `https://ui-avatars.com/api/?name=${user.name}&background=f0dcc6&color=5c3f24&size=64`
                    "
                    :alt="user.name"
                    class="size-10 rounded-full object-cover"
                />
                <div class="min-w-0 flex-1">
                    <p
                        class="truncate font-semibold text-sand-800 dark:text-sand-100"
                    >
                        {{ user.name }}
                    </p>
                    <p class="truncate text-sand-500 dark:text-sand-400">
                        @{{ user.username }}
                    </p>
                </div>
            </RouterLink>

            <div
                v-if="isLoadingMore"
                class="flex items-center justify-center gap-2 px-4 py-4 text-sand-500 dark:text-sand-400"
            >
                {{ t('Loading more...') }}
            </div>

            <p v-if="loadError" class="px-4 py-2 text-center text-blush-500">
                {{ loadError }}
            </p>

            <div ref="sentinel" class="h-1" />
        </div>
    </BottomSheet>
</template>
