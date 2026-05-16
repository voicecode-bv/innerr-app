<script setup lang="ts">
import { Camera, Events, Off, On } from '@nativephp/mobile';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { api, ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import { useAuthStore } from '@/spa/stores/auth';
import pencilIcon from '../../../../svg/doodle-icons/pencil-3.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

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
const bio = ref('');
const birthdate = ref('');
const searchable = ref(true);
const processing = ref(false);
const errors = ref<Record<string, string>>({});

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

async function loadProfile(): Promise<void> {
    try {
        const response = await externalApi.get<{ data: EditableProfile }>(
            '/profile',
        );
        avatar.value = response.data.avatar;
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
    if (avatarUploading.value) return;
    await Camera.pickImages().all();
}

async function handleMediaSelected(payload: {
    success: boolean;
    files: { path: string; mimeType: string }[];
    cancelled: boolean;
}): Promise<void> {
    if (!payload.success || payload.cancelled || !payload.files.length) {
        return;
    }

    avatarUploading.value = true;
    try {
        const response = await api.post<{ avatar: string | null }>(
            '/api/spa/settings/profile/avatar',
            {
                avatar_path: payload.files[0].path,
            },
        );
        avatar.value = response.avatar;
        if (auth.user) {
            auth.user.avatar = response.avatar;
        }
    } catch {
        // ignore — avatar blijft op huidige waarde
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

    const trimmedBio = bio.value.trim();
    const payload = {
        bio: trimmedBio === '' ? null : trimmedBio,
        birthdate: birthdate.value === '' ? null : birthdate.value,
        searchable: searchable.value,
    };

    try {
        await externalApi.patch('/profile', payload);
        bio.value = payload.bio ?? '';
        if (auth.user) {
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
            <button class="flex items-center text-teal" @click="goBack">
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
            class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]"
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
                                class="flex size-24 items-center justify-center rounded-full bg-sage-100 text-teal"
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
                                class="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-teal shadow-md ring-4 ring-white"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-4 bg-white"
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
                        <p class="text-teal-muted">
                            {{ t('Tap to change your photo') }}
                        </p>
                    </div>
                </SurfaceCard>

                <SurfaceCard class="reveal-item">
                    <form class="space-y-5" @submit.prevent="save">
                        <div>
                            <label
                                for="bio"
                                class="font-semibold text-teal"
                            >
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
                            <p v-if="errors.bio" class="mt-1 text-blush-500">
                                {{ errors.bio }}
                            </p>
                        </div>

                        <div>
                            <label
                                for="birthdate"
                                class="font-semibold text-teal"
                            >
                                {{ t('Birthdate') }}
                            </label>
                            <p class="mt-1 text-teal-muted">
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
                                class="mt-1 text-blush-500"
                            >
                                {{ errors.birthdate }}
                            </p>
                        </div>

                        <div>
                            <label
                                class="flex cursor-pointer items-start justify-between gap-3"
                            >
                                <span class="flex-1">
                                    <span class="block font-semibold text-teal">
                                        {{ t('Findable via search') }}
                                    </span>
                                    <span class="mt-1 block text-teal-muted">
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
                                    class="relative mt-1 inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                                    @click="searchable = !searchable"
                                >
                                    <span
                                        :class="
                                            searchable
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                        "
                                        class="pointer-events-none mt-1 size-6 rounded-full bg-white shadow transition-transform"
                                    />
                                </button>
                            </label>
                            <p
                                v-if="errors.searchable"
                                class="mt-1 text-blush-500"
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
                                class="rounded-lg bg-sage-100/70 px-4 py-2 text-sage-700"
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
    </AppLayout>
</template>
