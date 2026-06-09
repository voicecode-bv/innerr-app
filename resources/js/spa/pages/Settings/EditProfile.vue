<script setup lang="ts">
import { Camera, Events, Off, On } from '@nativephp/mobile';
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { api, ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useAuthStore } from '@/spa/stores/auth';
import pencilIcon from '../../../../svg/doodle-icons/pencil-3.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

const ImageCropModal = defineAsyncComponent(
    () => import('@/components/ImageCropModal.vue'),
);

interface EditableProfile {
    id: number;
    name: string;
    username: string;
    avatar: string | null;
    bio: string | null;
    birthdate: string | null;
    searchable: boolean;
}

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();

const isLoading = ref(true);
const avatarUploading = ref(false);
const avatar = ref<string | null>(null);
const username = ref('');
const bio = ref('');
const birthdate = ref('');
const searchable = ref(true);
const processing = ref(false);
const errors = ref<Record<string, string>>({});

const showCropModal = ref(false);
const cropSource = ref<string | null>(null);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

async function loadProfile(): Promise<void> {
    try {
        const response = await externalApi.get<{ data: EditableProfile }>(
            '/profile',
        );
        avatar.value = response.data.avatar;
        username.value = response.data.username ?? '';
        bio.value = response.data.bio ?? '';
        birthdate.value = response.data.birthdate ?? '';
        searchable.value = response.data.searchable ?? true;
    } catch {
        // ignore — gebruiker krijgt lege velden
    } finally {
        isLoading.value = false;
    }
}

onMounted(loadProfile);

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
    if (!payload.success || payload.cancelled || !payload.files.length) {
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
    avatarUploading.value = true;

    const previousAvatar = avatar.value;
    avatar.value = dataUrl;

    try {
        const buffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);

        const response = await api.post<{ avatar: string | null }>(
            '/api/spa/settings/profile/avatar',
            {
                avatar_data: base64,
            },
        );
        avatar.value = response.avatar;

        if (auth.user) {
            auth.user.avatar = response.avatar;
        }
    } catch {
        avatar.value = previousAvatar;
    } finally {
        avatarUploading.value = false;
    }
}

onMounted(() => On(Events.Gallery.MediaSelected, handleMediaSelected));
onUnmounted(() => Off(Events.Gallery.MediaSelected, handleMediaSelected));

const saved = ref(false);

async function save(): Promise<void> {
    saved.value = false;
    processing.value = true;
    errors.value = {};

    const trimmedUsername = username.value.trim();
    const trimmedBio = bio.value.trim();
    const payload = {
        username: trimmedUsername,
        bio: trimmedBio === '' ? null : trimmedBio,
        birthdate: birthdate.value === '' ? null : birthdate.value,
        searchable: searchable.value,
    };

    try {
        await externalApi.patch('/profile', payload);
        username.value = payload.username;
        bio.value = payload.bio ?? '';

        if (auth.user) {
            auth.user.username = payload.username;
            auth.user.bio = payload.bio;
        }

        saved.value = true;
        setTimeout(() => {
            saved.value = false;
        }, 2500);
    } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
            errors.value = Object.fromEntries(
                Object.entries(error.errors).map(([key, value]) => [
                    key,
                    value[0] ?? '',
                ]),
            );
        }
    } finally {
        processing.value = false;
    }
}
</script>

<template>
    <AppLayout :title="t('Edit profile')">
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

        <div
            class="relative mt-10 min-h-full pb-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))]"
        >
            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <SurfaceCard class="reveal-item">
                    <div class="flex flex-col items-center gap-3">
                        <button
                            type="button"
                            class="relative shrink-0"
                            :disabled="avatarUploading"
                            :aria-label="t('Change photo')"
                            @click="pickAvatar"
                        >
                            <img
                                v-if="avatar"
                                :src="avatar"
                                :alt="t('Profile photo')"
                                class="avatar-ring size-24 rounded-full object-cover"
                                :class="{ 'opacity-60': avatarUploading }"
                            />
                            <span
                                v-else
                                class="flex size-24 items-center justify-center rounded-full bg-brand-blue/50 text-ink"
                                :class="{ 'opacity-60': avatarUploading }"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-12 bg-current"
                                    :style="{
                                        maskImage: `url(${userIcon})`,
                                        WebkitMaskImage: `url(${userIcon})`,
                                        maskSize: 'contain',
                                        WebkitMaskSize: 'contain',
                                        maskRepeat: 'no-repeat',
                                        WebkitMaskRepeat: 'no-repeat',
                                        maskPosition: 'center',
                                        WebkitMaskPosition: 'center',
                                    }"
                                ></span>
                            </span>
                            <span
                                class="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-action shadow-md ring-2 ring-white dark:ring-ink-muted"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-4 bg-surface dark:bg-ink-muted"
                                    :style="{
                                        maskImage: `url(${pencilIcon})`,
                                        WebkitMaskImage: `url(${pencilIcon})`,
                                        maskSize: 'contain',
                                        WebkitMaskSize: 'contain',
                                        maskRepeat: 'no-repeat',
                                        WebkitMaskRepeat: 'no-repeat',
                                        maskPosition: 'center',
                                        WebkitMaskPosition: 'center',
                                    }"
                                ></span>
                            </span>
                        </button>
                        <p class="text-ink-muted">
                            {{ t('Tap to change your photo') }}
                        </p>
                    </div>
                </SurfaceCard>

                <SurfaceCard class="reveal-item">
                    <form class="space-y-5" @submit.prevent="save">
                        <div>
                            <label
                                for="username"
                                class="font-semibold text-ink"
                            >
                                {{ t('Username') }}
                            </label>
                            <input
                                id="username"
                                v-model="username"
                                type="text"
                                autocapitalize="none"
                                autocorrect="off"
                                spellcheck="false"
                                class="mt-2 box-border block field w-full max-w-full min-w-0 appearance-none"
                            />
                            <p
                                v-if="errors.username"
                                class="mt-1 text-destructive-ink"
                            >
                                {{ errors.username }}
                            </p>
                        </div>

                        <div>
                            <label for="bio" class="font-semibold text-ink">
                                {{ t('Bio') }}
                            </label>
                            <textarea
                                id="bio"
                                v-model="bio"
                                class="mt-2 field-area"
                                rows="4"
                                maxlength="1000"
                                :placeholder="
                                    t('Write something about yourself...')
                                "
                            />
                            <p
                                v-if="errors.bio"
                                class="mt-1 text-destructive-ink"
                            >
                                {{ errors.bio }}
                            </p>
                        </div>

                        <div>
                            <label
                                for="birthdate"
                                class="font-semibold text-ink"
                            >
                                {{ t('Birthdate') }}
                            </label>
                            <p class="mt-1 text-ink-muted">
                                {{
                                    t(
                                        'Your birthdate is used to show your age on tagged photos.',
                                    )
                                }}
                            </p>
                            <input
                                id="birthdate"
                                v-model="birthdate"
                                type="date"
                                class="mt-2 box-border block field w-full max-w-full min-w-0 appearance-none"
                            />
                            <p
                                v-if="errors.birthdate"
                                class="mt-1 text-destructive-ink"
                            >
                                {{ errors.birthdate }}
                            </p>
                        </div>

                        <div>
                            <label
                                class="flex cursor-pointer items-start justify-between gap-3"
                            >
                                <span class="flex-1">
                                    <span class="block font-semibold text-ink">
                                        {{ t('Findable via search') }}
                                    </span>
                                    <span class="mt-1 block text-ink-muted">
                                        {{
                                            t(
                                                'Turn this off to hide your profile from search results.',
                                            )
                                        }}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    :aria-checked="searchable"
                                    :aria-label="t('Findable via search')"
                                    :class="
                                        searchable
                                            ? 'bg-brand-green'
                                            : 'bg-sand-300'
                                    "
                                    class="relative mt-1 inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
                                    @click="searchable = !searchable"
                                >
                                    <span
                                        :class="
                                            searchable
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                        "
                                        class="pointer-events-none mt-1 size-6 rounded-full bg-surface shadow transition-transform"
                                    />
                                </button>
                            </label>
                            <p
                                v-if="errors.searchable"
                                class="mt-1 text-destructive-ink"
                            >
                                {{ errors.searchable }}
                            </p>
                        </div>

                        <Transition
                            enter-active-class="transition duration-200 ease-out"
                            enter-from-class="opacity-0"
                            enter-to-class="opacity-100"
                            leave-active-class="transition duration-150 ease-in"
                            leave-from-class="opacity-100"
                            leave-to-class="opacity-0"
                        >
                            <p
                                v-if="saved"
                                class="rounded-lg bg-success-soft/70 px-4 py-2 text-success-ink"
                            >
                                {{ t('Profile saved.') }}
                            </p>
                        </Transition>

                        <div class="flex justify-end">
                            <Button
                                type="submit"
                                size="md"
                                :disabled="processing || isLoading"
                            >
                                {{ processing ? t('Saving...') : t('Save') }}
                            </Button>
                        </div>
                    </form>
                </SurfaceCard>
            </div>
        </div>

        <ImageCropModal
            :open="showCropModal"
            :src="cropSource"
            locked-ratio="1:1"
            @update:open="showCropModal = $event"
            @cropped="handleCropped"
        />
    </AppLayout>
</template>
