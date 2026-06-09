<script setup lang="ts">
import { onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { RouterLink } from 'vue-router';
import BottomSheet from '@/components/BottomSheet.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import SheetHeader from '@/components/SheetHeader.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import userIcon from '../../../svg/doodle-icons/user.svg';

interface LikeUser {
    id: string;
    is_visible?: boolean;
    name?: string;
    username?: string;
    avatar?: string | null;
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

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const props = defineProps<{
    open: boolean;
    postId: string;
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
const seenIds = new Set<string>();

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
            if (seenIds.has(u.id)) {
                return false;
            }

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
    ) {
        return;
    }

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
        if (!isOpen) {
            return;
        }

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
            <SheetHeader :title="t('Likes')" @close="close" />
        </template>

        <div
            v-if="isLoading"
            class="flex items-center justify-center px-4 py-10"
        >
            <LoadingSpinner />
        </div>

        <div
            v-else-if="loadError && users.length === 0"
            class="px-4 py-10 text-center"
        >
            <p class="text-destructive-ink">{{ loadError }}</p>
            <button class="mt-2 text-ink-muted" @click="loadPage(1)">
                {{ t('Try again') }}
            </button>
        </div>

        <div
            v-else-if="hasLoaded && users.length === 0"
            class="px-4 py-10 text-center"
        >
            <p class="text-ink-muted">
                {{ t('No likes yet') }}
            </p>
        </div>

        <div
            v-else
            class="pb-[calc(theme(spacing.4)+env(safe-area-inset-bottom))]"
        >
            <template v-for="user in users" :key="user.id">
                <RouterLink
                    v-if="user.is_visible !== false && user.username"
                    :to="{
                        name: 'spa.profiles.show',
                        params: { username: user.username },
                    }"
                    class="flex items-center gap-3 border-b border-sand-50 px-4 py-3"
                    @click="close"
                >
                    <img
                        :src="
                            user.avatar ??
                            `https://ui-avatars.com/api/?name=${user.name}&background=f0dcc6&color=5c3f24&size=64`
                        "
                        :alt="user.name"
                        class="avatar-ring size-10 rounded-full object-cover"
                    />
                    <div class="min-w-0 flex-1">
                        <p class="truncate leading-none font-semibold text-ink">
                            {{ user.name }}
                        </p>
                        <p class="truncate text-ink-muted">
                            @{{ user.username }}
                        </p>
                    </div>
                </RouterLink>

                <div
                    v-else
                    class="flex items-center gap-3 border-b border-sand-50 px-4 py-3"
                >
                    <span
                        aria-hidden="true"
                        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-ink"
                    >
                        <span
                            class="inline-block size-5 bg-current"
                            :style="iconMaskStyle(userIcon)"
                        ></span>
                    </span>
                    <p class="truncate text-ink-muted italic">
                        {{ t('Hidden person') }}
                    </p>
                </div>
            </template>

            <div
                v-if="isLoadingMore"
                class="flex items-center justify-center gap-2 px-4 py-4 text-ink-muted"
            >
                {{ t('Loading more...') }}
            </div>

            <p
                v-if="loadError"
                class="px-4 py-2 text-center text-destructive-ink"
            >
                {{ loadError }}
            </p>

            <div ref="sentinel" class="h-1" />
        </div>
    </BottomSheet>
</template>
