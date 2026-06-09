<script setup lang="ts">
import { Camera, Events, Off, On } from '@nativephp/mobile';
import {
    computed,
    defineAsyncComponent,
    onMounted,
    onUnmounted,
    ref,
    useTemplateRef,
} from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import InviteToCircleSheet from '@/spa/components/InviteToCircleSheet.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import PostMasonry from '@/spa/components/PostMasonry.vue';
import { useInfiniteScroll } from '@/spa/composables/useInfiniteScroll';
import type { PaginatedResponse } from '@/spa/composables/useInfiniteScroll';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { api } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useAuthStore } from '@/spa/stores/auth';
import { useFeedSelectionStore } from '@/spa/stores/feedSelection';
import { useLocalThumbnailsStore } from '@/spa/stores/localThumbnails';
import checklistIcon from '../../../svg/doodle-icons/checklist.svg';
import crossIcon from '../../../svg/doodle-icons/cross.svg';
import editIcon from '../../../svg/doodle-icons/pencil.svg';
import settingsIcon from '../../../svg/doodle-icons/setting-2.svg';

const ImageCropModal = defineAsyncComponent(
    () => import('@/components/ImageCropModal.vue'),
);

interface Profile {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    bio: string | null;
    created_at: string;
    posts_count: number;
}

const { t } = useTranslations();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const feedSelection = useFeedSelectionStore();
const localThumbnails = useLocalThumbnailsStore();

// PostTile renders images from the aspect-preserving `media_url` and videos
// from their poster. The only gap is a freshly uploaded video that is still
// transcoding: its `media_url` is the .mp4 (won't render as <img>) and it has
// no CDN poster yet, so we surface the locally-generated JPEG thumbnail from
// the plugin. Every other case returns null and lets PostTile use the API URL.
function resolvedPoster(post: PostData): string | null {
    if (post.media_type === 'video' && post.media_status !== 'ready') {
        return localThumbnails.get(post.id) ?? post.thumbnail_url ?? null;
    }

    return null;
}

const username = computed(() => String(route.params.username));
const isOwnProfile = computed(() => auth.user?.username === username.value);

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);
const sentinelRef = ref<HTMLElement | null>(null);

const profile = ref<Profile | null>(null);

async function loadProfile(): Promise<void> {
    try {
        const data = await externalApi.get<{ data: Profile }>(
            `/profiles/${username.value}`,
        );
        profile.value = data.data;
    } catch {
        router.push({ name: 'spa.home' });
    }
}

const feed = useInfiniteScroll<PostData>(
    (page) =>
        externalApi.get<PaginatedResponse<PostData>>(
            `/profiles/${username.value}/posts?page=${page}`,
        ),
    sentinelRef,
);

async function refresh(): Promise<void> {
    await Promise.all([loadProfile(), feed.reset()]);
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: refresh,
    containerRef,
});

onMounted(loadProfile);

function goBack(): void {
    if (window.history.length > 1) {
        router.back();
    } else {
        router.push({ name: 'spa.home' });
    }
}

// Hidden gesture: tap the "Profile" title 10× to open the (public) debug page,
// mirroring the 10-tap logo gesture on the login screen. The counter resets if
// tapping pauses, so stray taps do nothing.
const TITLE_TAPS_REQUIRED = 10;
const TITLE_TAP_RESET_MS = 1500;

let titleTapCount = 0;
let titleTapResetTimer: ReturnType<typeof setTimeout> | null = null;

function handleTitleTap(): void {
    titleTapCount += 1;

    if (titleTapResetTimer) {
        clearTimeout(titleTapResetTimer);
        titleTapResetTimer = null;
    }

    if (titleTapCount >= TITLE_TAPS_REQUIRED) {
        titleTapCount = 0;
        router.push({ name: 'spa.dev.debug' });

        return;
    }

    titleTapResetTimer = setTimeout(() => {
        titleTapCount = 0;
        titleTapResetTimer = null;
    }, TITLE_TAP_RESET_MS);
}

const avatarUploading = ref(false);
const showCropModal = ref(false);
const cropSource = ref<string | null>(null);

async function pickAvatar(): Promise<void> {
    if (avatarUploading.value) {
        return;
    }

    await Camera.pickImages().all();
}

async function loadPreview(path: string): Promise<string | null> {
    try {
        const response = await fetch(
            `/native-media?path=${encodeURIComponent(path)}`,
        );

        if (!response.ok) {
            return null;
        }

        const { data_url } = await response.json();

        return data_url;
    } catch {
        return null;
    }
}

async function handleMediaSelected(payload: {
    success: boolean;
    files: { path: string; mimeType: string }[];
    cancelled: boolean;
}): Promise<void> {
    if (
        !payload.success ||
        payload.cancelled ||
        !payload.files.length ||
        !isOwnProfile.value ||
        !profile.value
    ) {
        return;
    }

    const preview = await loadPreview(payload.files[0].path);

    if (!preview) {
        return;
    }

    cropSource.value = preview;
    showCropModal.value = true;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + chunkSize)),
        );
    }

    return btoa(binary);
}

async function handleCropped(blob: Blob, dataUrl: string): Promise<void> {
    showCropModal.value = false;
    cropSource.value = null;

    if (!profile.value) {
        return;
    }

    avatarUploading.value = true;

    const previousAvatar = profile.value.avatar;
    profile.value.avatar = dataUrl;

    try {
        const buffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);

        const response = await api.post<{ avatar: string | null }>(
            '/api/spa/settings/profile/avatar',
            {
                avatar_data: base64,
            },
        );

        if (profile.value) {
            profile.value.avatar = response.avatar;
        }

        if (auth.user) {
            auth.user.avatar = response.avatar;
        }
    } catch {
        if (profile.value) {
            profile.value.avatar = previousAvatar;
        }
    } finally {
        avatarUploading.value = false;
    }
}

onMounted(() => {
    On(Events.Gallery.MediaSelected, handleMediaSelected);
});

onUnmounted(() => {
    Off(Events.Gallery.MediaSelected, handleMediaSelected);
    // Never carry a selection across navigation away from the profile.
    feedSelection.disable();
});

const inviteSheetOpen = ref(false);

function openInviteSheet(): void {
    inviteSheetOpen.value = true;
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
    <AppLayout ref="layout" :title="t('Profile')">
        <template #title>
            <button
                type="button"
                class="max-w-full truncate p-0"
                @click="handleTitleTap"
            >
                {{ t('Profile') }}
            </button>
        </template>

        <template #header-left>
            <button class="flex items-center text-ink" @click="goBack">
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

        <template v-if="profile && isOwnProfile" #header-right>
            <RouterLink
                :to="{ name: 'spa.settings' }"
                class="flex items-center text-ink"
                :aria-label="t('Open settings')"
                data-tour="profile.settings"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-5 bg-current"
                    :style="iconMaskStyle(settingsIcon)"
                ></span>
            </RouterLink>
        </template>

        <div
            class="mt-10 pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div>
                <div
                    v-if="profile"
                    data-tour="profile.header"
                    class="bg-sand px-4 py-6"
                >
                    <div class="flex items-center gap-4">
                        <button
                            type="button"
                            class="relative shrink-0"
                            :disabled="!isOwnProfile || avatarUploading"
                            :aria-label="
                                isOwnProfile ? t('Change photo') : undefined
                            "
                            @click="isOwnProfile && pickAvatar()"
                        >
                            <img
                                :src="
                                    profile.avatar ??
                                    `https://ui-avatars.com/api/?name=${profile.name}&background=f0dcc6&color=5c3f24&size=128`
                                "
                                :alt="profile.name"
                                class="avatar-ring size-20 rounded-full object-cover"
                                :class="{ 'opacity-60': avatarUploading }"
                            />
                            <span
                                v-if="isOwnProfile"
                                class="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-action shadow-md ring-2 ring-white"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="2"
                                    stroke="currentColor"
                                    class="size-3.5 text-white"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
                                    />
                                </svg>
                            </span>
                        </button>
                        <div class="min-w-0 flex-1">
                            <h2
                                class="truncate font-sans text-xl font-bold text-ink"
                            >
                                {{ profile.name }}
                            </h2>
                            <p class="text-ink-muted">
                                @{{ profile.username }}
                            </p>
                            <div>
                                <span class="font-medium text-ink">{{
                                    profile.posts_count
                                }}</span>
                                <span class="ml-1 text-ink-muted">{{
                                    profile.posts_count === 1
                                        ? t('moment')
                                        : t('moments')
                                }}</span>
                            </div>
                            <p v-if="profile.bio" class="text-ink">
                                {{ profile.bio }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="isOwnProfile"
                        class="-mx-4 mt-4 flex items-center border-y border-dark-sand px-4 py-3"
                    >
                        <RouterLink
                            :to="{ name: 'spa.settings.edit-profile' }"
                            class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-sand-100"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-5 bg-ink"
                                :style="iconMaskStyle(editIcon)"
                            ></span>
                            <span class="text-sm font-medium text-ink">{{
                                t('Edit')
                            }}</span>
                        </RouterLink>
                        <button
                            type="button"
                            class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-sand-100"
                            @click="feedSelection.toggleActive()"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-5"
                                :class="
                                    feedSelection.active
                                        ? 'bg-brand-orange'
                                        : 'bg-ink'
                                "
                                :style="
                                    iconMaskStyle(
                                        feedSelection.active
                                            ? crossIcon
                                            : checklistIcon,
                                    )
                                "
                            ></span>
                            <span
                                class="text-sm font-medium"
                                :class="
                                    feedSelection.active
                                        ? 'text-brand-orange'
                                        : 'text-ink'
                                "
                                >{{
                                    feedSelection.active
                                        ? t('Cancel selection')
                                        : t('Select photos')
                                }}</span
                            >
                        </button>
                    </div>
                    <Button
                        v-else
                        variant="primary"
                        size="lg"
                        block
                        class="mt-4"
                        @click="openInviteSheet"
                    >
                        {{ t('Invite') }}
                    </Button>
                </div>

                <div class="h-2 bg-sand" />

                <PostMasonry
                    class="pt-2"
                    :posts="feed.items"
                    :loading="feed.loading"
                    :resolve-poster="resolvedPoster"
                    :selectable="isOwnProfile"
                />

                <div
                    v-if="feed.loading && feed.items.length > 0"
                    class="flex items-center justify-center gap-2 py-6 text-ink-muted"
                >
                    {{ t('Loading more...') }}
                </div>

                <div ref="sentinelRef" class="h-1" />

                <div
                    v-if="!feed.loading && feed.items.length === 0"
                    class="flex flex-col items-center justify-center px-8 py-20 text-center"
                >
                    <div
                        aria-hidden="true"
                        class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-success-soft text-ink dark:bg-brand-blue"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="size-8"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                            />
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
                            />
                        </svg>
                    </div>
                    <h3 class="font-display text-lg font-semibold text-ink">
                        {{ t('No moments yet') }}
                    </h3>
                </div>
            </div>
        </div>

        <InviteToCircleSheet
            v-if="profile && !isOwnProfile"
            v-model:open="inviteSheetOpen"
            :username="profile.username"
            :person-name="profile.name"
        />

        <ImageCropModal
            :open="showCropModal"
            :src="cropSource"
            locked-ratio="1:1"
            @update:open="showCropModal = $event"
            @cropped="handleCropped"
        />
    </AppLayout>
</template>
