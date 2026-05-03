<script setup lang="ts">
import { Camera, Edge, Events, Off, On } from '@nativephp/mobile';
import {
    computed,
    defineAsyncComponent,
    onMounted,
    onUnmounted,
    ref,
    watch,
} from 'vue';
import { useRouter } from 'vue-router';
import CirclePicker from '@/components/CirclePicker.vue';
import PersonPicker from '@/components/PersonPicker.vue';
import type { ExifData } from '@/composables/useExif';

const ImageCropModal = defineAsyncComponent(
    () => import('@/components/ImageCropModal.vue'),
);
const TagSelector = defineAsyncComponent(
    () => import('@/spa/components/TagSelector.vue'),
);
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
import { useDefaultCirclesStore } from '@/spa/stores/defaultCircles';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { usePersonsStore } from '@/spa/stores/persons';
import { useTagsStore } from '@/spa/stores/tags';
import type { PostData } from '@/spa/components/PostCard.vue';
import { api } from '@/spa/http/apiClient';
import cameraIcon from '../../../svg/doodle-icons/camera.svg';
import cropIcon from '../../../svg/doodle-icons/crop.svg';
import photoIcon from '../../../svg/doodle-icons/photo.svg';
import videoCameraIcon from '../../../svg/doodle-icons/video-camera.svg';

interface Circle {
    id: number;
    name: string;
    photo?: string | null;
    members_count?: number;
    members_can_invite?: boolean;
    is_owner?: boolean;
}

interface Tag {
    id: number;
    name: string;
    usage_count?: number;
}

interface Person {
    id: number;
    name: string;
    avatar?: string | null;
    avatar_thumbnail?: string | null;
    user_id?: number | null;
    circle_ids?: number[];
}

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();
const feedCache = useFeedCacheStore();
const circlesStore = useCirclesStore();
const personsStore = usePersonsStore();
const tagsStore = useTagsStore();
const defaultCirclesStore = useDefaultCirclesStore();

const circles = computed<Circle[]>(() => circlesStore.items ?? []);
const defaultCircleIds = computed<number[]>(
    () => defaultCirclesStore.ids ?? [],
);
const availableTags = computed<Tag[]>(() => tagsStore.items ?? []);
const allPersons = computed<Person[]>(() => personsStore.items ?? []);
const availablePersons = computed<Person[]>(() => {
    const selected = form.data.circle_ids;
    if (selected.length === 0) return [];
    return allPersons.value.filter((person) =>
        (person.circle_ids ?? []).some((id) => selected.includes(id)),
    );
});

async function loadFormData(): Promise<void> {
    try {
        await Promise.all([
            circlesStore.ensureLoaded(),
            defaultCirclesStore.ensureLoaded().catch(() => null),
            tagsStore.ensureLoaded().catch(() => null),
            personsStore.ensureLoaded().catch(() => null),
        ]);

        const availableIds = circles.value.map((c) => c.id);
        form.data.circle_ids = defaultCircleIds.value.filter((id) =>
            availableIds.includes(id),
        );
    } catch {
        // ignore
    }
}

const form = useApiForm({
    media_path: null as string | null,
    caption: '',
    circle_ids: [] as number[],
    tag_ids: [] as number[],
    person_ids: [] as number[],
});

const mediaPreview = ref<string | null>(null);
const mediaIsVideo = ref(false);
const showSourcePicker = ref(false);
const showCropModal = ref(false);

// Wizard-stappen: 0=media, 1=caption, 2=cirkels, 3=tags & personen.
const TOTAL_STEPS = 4;
const currentStep = ref(0);

const hasMedia = computed(() => form.data.media_path !== null);
const hasMetadata = computed(
    () => form.data.tag_ids.length > 0 || form.data.person_ids.length > 0,
);
const hasCircles = computed(() => form.data.circle_ids.length > 0);

const canAdvance = computed(() => {
    switch (currentStep.value) {
        case 0:
            return hasMedia.value;
        case 1:
        case 3:
            return true;
        case 2:
            return hasCircles.value;
        default:
            return false;
    }
});

const stepHeading = computed(() => {
    switch (currentStep.value) {
        case 0:
            return t('Choose your moment');
        case 1:
            return t('Tell your story');
        case 2:
            return t('Choose your circles');
        case 3:
            return t('Tag people and topics');
        default:
            return '';
    }
});

const stepSubtitle = computed(() => {
    switch (currentStep.value) {
        case 0:
            return t('Pick a photo or video to share');
        case 1:
            return t('Add a caption to give context');
        case 2:
            return t('Choose who you want to share with');
        case 3:
            return t('Help others find this moment');
        default:
            return '';
    }
});

const primaryLabel = computed(() => {
    if (currentStep.value === TOTAL_STEPS - 1) {
        return form.processing ? t('Sharing...') : t('Share');
    }
    if (currentStep.value === 1 && !form.data.caption.trim()) {
        return t('Skip');
    }
    if (currentStep.value === 3 && !hasMetadata.value) {
        return t('Skip');
    }
    return t('Next');
});

// Drop tagged persons that are no longer in any of the selected circles.
watch(
    () => form.data.circle_ids,
    (ids) => {
        if (form.data.person_ids.length === 0) return;
        const stillVisible = new Set(availablePersons.value.map((p) => p.id));
        form.data.person_ids = form.data.person_ids.filter((id) =>
            stillVisible.has(id),
        );
    },
);

function goNext(): void {
    if (currentStep.value === TOTAL_STEPS - 1) {
        submit();
        return;
    }
    if (!canAdvance.value) return;
    currentStep.value = Math.min(TOTAL_STEPS - 1, currentStep.value + 1);
}

function goBack(): void {
    if (currentStep.value === 0) {
        router.push({ name: 'spa.home' });
        return;
    }
    currentStep.value = Math.max(0, currentStep.value - 1);
}

function openSourcePicker(): void {
    showSourcePicker.value = true;
}

async function selectFromGallery(): Promise<void> {
    showSourcePicker.value = false;
    await Camera.pickImages().all();
}

async function openCamera(): Promise<void> {
    showSourcePicker.value = false;
    await Camera.getPhoto();
}

async function recordVideo(): Promise<void> {
    showSourcePicker.value = false;
    await Camera.recordVideo();
}

async function loadPreview(path: string): Promise<string | null> {
    try {
        const response = await fetch(
            `/native-media?path=${encodeURIComponent(path)}`,
        );
        if (!response.ok) return null;
        const { data_url } = await response.json();
        return data_url;
    } catch {
        return null;
    }
}

async function handlePhotoTaken(payload: {
    path: string;
    mimeType: string;
}): Promise<void> {
    form.data.media_path = payload.path;
    mediaPreview.value = await loadPreview(payload.path);
    mediaIsVideo.value = false;
}

async function handleVideoRecorded(payload: {
    path: string;
    mimeType: string;
}): Promise<void> {
    form.data.media_path = payload.path;
    mediaPreview.value = await loadPreview(payload.path);
    mediaIsVideo.value = true;
}

async function handleMediaSelected(payload: {
    success: boolean;
    files: { path: string; mimeType: string }[];
    cancelled: boolean;
}): Promise<void> {
    if (!payload.success || payload.cancelled || !payload.files.length) return;

    const file = payload.files[0];
    form.data.media_path = file.path;
    mediaPreview.value = await loadPreview(file.path);
    mediaIsVideo.value = file.mimeType?.startsWith('video/') ?? false;
}

function removeMedia(): void {
    form.data.media_path = null;
    mediaPreview.value = null;
    mediaIsVideo.value = false;
}

function openCropModal(): void {
    if (!mediaPreview.value || mediaIsVideo.value) return;
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

async function handleCropped(
    blob: Blob,
    dataUrl: string,
    exif: ExifData,
): Promise<void> {
    const buffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    try {
        const response = await api.post<{ path: string }>(
            '/posts/cropped-media',
            {
                data: base64,
                taken_at: exif.taken_at,
                latitude: exif.latitude,
                longitude: exif.longitude,
            },
        );
        form.data.media_path = response.path;
        mediaPreview.value = dataUrl;
        showCropModal.value = false;
    } catch {
        // crop submit failed; user kan retry
    }
}

onMounted(() => {
    // Native edge bottom-nav verbergen vóór de eerste paint: anders overlapt
    // hij onze sticky wizard-footer tot de async EdgeController-call resolved
    // is, en zijn de Back/Next-knoppen niet aan te tikken. Sync via de bridge,
    // geen netwerkronde. afterEach in de router herstelt de bottom-nav weer
    // bij navigatie naar een volgende route.
    try {
        Edge.clearSync();
    } catch {
        // Niet-native context (browser preview): geen edge-bar om te clearen.
    }

    loadFormData();
    On(Events.Camera.PhotoTaken, handlePhotoTaken);
    On(Events.Camera.VideoRecorded, handleVideoRecorded);
    On(Events.Gallery.MediaSelected, handleMediaSelected);
});

onUnmounted(() => {
    Off(Events.Camera.PhotoTaken, handlePhotoTaken);
    Off(Events.Camera.VideoRecorded, handleVideoRecorded);
    Off(Events.Gallery.MediaSelected, handleMediaSelected);
});

function buildOptimisticPost(): PostData {
    const tempId = -Date.now();
    const isVideo = mediaIsVideo.value;
    const previewUrl = mediaPreview.value ?? '';
    const selectedCircles = circles.value
        .filter((c) => form.data.circle_ids.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name, photo: c.photo ?? null }));

    return {
        id: tempId,
        media_url: previewUrl,
        media_type: isVideo ? 'video' : 'image',
        thumbnail_url: isVideo ? previewUrl : null,
        thumbnail_small_url: isVideo ? previewUrl : null,
        media_status: 'processing',
        caption: form.data.caption ?? null,
        location: null,
        created_at: new Date().toISOString(),
        user: {
            id: auth.user?.id ?? 0,
            name: auth.user?.name ?? '',
            username: auth.user?.username ?? '',
            avatar: auth.user?.avatar ?? null,
        },
        circles: selectedCircles,
        is_liked: false,
        likes_count: 0,
        comments_count: 0,
    };
}

async function submit(): Promise<void> {
    if (form.processing || !hasMedia.value || !hasCircles.value) return;

    const hasPreview = !!mediaPreview.value;
    const optimistic = hasPreview ? buildOptimisticPost() : null;
    const targetCircleIds = [...form.data.circle_ids];

    if (optimistic) {
        feedCache.prepend('home', optimistic);
        for (const circleId of targetCircleIds) {
            feedCache.prepend(`circle:${circleId}`, optimistic);
        }
    }

    router.push({ name: 'spa.home' });

    try {
        await form.post('/api/spa/posts');
        feedCache.invalidate('home');
        for (const circleId of targetCircleIds) {
            feedCache.invalidate(`circle:${circleId}`);
        }
    } catch {
        if (optimistic) {
            feedCache.removeItem('home', optimistic.id);
            for (const circleId of targetCircleIds) {
                feedCache.removeItem(`circle:${circleId}`, optimistic.id);
            }
        }
    }
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
    <AppLayout :title="t('New post')">
        <template #header-left>
            <button
                class="flex items-center text-sand-700 dark:text-sand-300"
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

        <div class="relative mt-10 flex min-h-full flex-col">
            <div class="flex-shrink-0 px-4 pt-4">
                <div
                    class="flex items-center justify-center gap-1.5"
                    :aria-label="
                        t('Step :current of :total', {
                            current: currentStep + 1,
                            total: TOTAL_STEPS,
                        })
                    "
                >
                    <span
                        v-for="step in TOTAL_STEPS"
                        :key="step"
                        class="h-1.5 rounded-full transition-all duration-200"
                        :class="
                            step - 1 === currentStep
                                ? 'w-8 bg-teal'
                                : step - 1 < currentStep
                                  ? 'w-4 bg-teal/60'
                                  : 'w-4 bg-sand-200 dark:bg-sand-700'
                        "
                    />
                </div>
                <p
                    class="mt-3 text-center tracking-widest text-sand-500 uppercase dark:text-sand-400"
                >
                    {{
                        t('Step :current of :total', {
                            current: currentStep + 1,
                            total: TOTAL_STEPS,
                        })
                    }}
                </p>
                <h2
                    class="mt-1 text-center font-display text-2xl font-semibold text-teal dark:text-sage-100"
                >
                    {{ stepHeading }}
                </h2>
                <p class="mt-1 text-center text-sand-600 dark:text-sand-400">
                    {{ stepSubtitle }}
                </p>
            </div>

            <div class="relative mt-6 flex-1 space-y-5 px-4 pb-6">
                <section
                    v-show="currentStep === 0"
                    class="overflow-hidden rounded-lg bg-white/50 shadow-sm backdrop-blur-sm dark:bg-sand-800/60"
                >
                    <div v-if="mediaPreview" class="relative">
                        <video
                            v-if="mediaIsVideo"
                            :src="mediaPreview"
                            class="w-full object-cover"
                            controls
                        />
                        <img
                            v-else
                            :src="mediaPreview"
                            class="w-full object-cover"
                            :alt="t('Selected photo')"
                        />
                        <button
                            v-if="!mediaIsVideo"
                            class="absolute top-3 left-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                            :aria-label="t('Crop photo')"
                            @click="openCropModal"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-4 bg-current"
                                :style="iconMaskStyle(cropIcon)"
                            ></span>
                        </button>
                        <button
                            class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                            :aria-label="t('Cancel')"
                            @click="removeMedia"
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
                    </div>

                    <button
                        v-else
                        class="flex w-full flex-col items-center justify-center gap-3 px-8 py-14 active:bg-sand-100/40 dark:active:bg-sand-800/40"
                        @click="openSourcePicker"
                    >
                        <div
                            class="flex size-20 items-center justify-center rounded-2xl bg-sage-100 text-teal dark:bg-sage-900/40"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-10 bg-current"
                                :style="iconMaskStyle(cameraIcon)"
                            ></span>
                        </div>
                        <span class="text-sand-600 dark:text-sand-300">{{
                            t('Add a photo')
                        }}</span>
                    </button>

                    <p
                        v-if="form.errors.media_path"
                        class="px-5 pb-4 text-blush-500"
                    >
                        {{ form.errors.media_path }}
                    </p>
                </section>

                <section
                    v-show="currentStep === 1"
                    class="rounded-lg bg-white/50 p-5 shadow-sm backdrop-blur-sm dark:bg-sand-800/60"
                >
                    <label
                        for="post-caption"
                        class="tracking-wider text-sand-500 uppercase dark:text-sand-400"
                    >
                        {{ t('Caption') }}
                    </label>
                    <textarea
                        id="post-caption"
                        v-model="form.data.caption"
                        :placeholder="t('Write a caption...')"
                        rows="6"
                        maxlength="2200"
                        class="mt-2 w-full resize-none border-0 bg-transparent p-0 text-base text-sand-800 placeholder-sand-400 focus:ring-0 focus:outline-none dark:text-sand-100 dark:placeholder-sand-500"
                    />
                    <p v-if="form.errors.caption" class="mt-1 text-blush-500">
                        {{ form.errors.caption }}
                    </p>
                </section>

                <section
                    v-show="currentStep === 2"
                    class="rounded-lg bg-white/50 p-5 shadow-sm backdrop-blur-sm dark:bg-sand-800/60"
                >
                    <CirclePicker
                        v-if="circles.length > 0"
                        :circles="circles"
                        :selected-ids="form.data.circle_ids"
                        :error="form.errors.circle_ids"
                        layout="grid"
                        @update:selected-ids="form.data.circle_ids = $event"
                    />
                    <p v-else class="text-sand-600 dark:text-sand-400">
                        {{
                            t(
                                'Create a circle to set it as a default for new posts.',
                            )
                        }}
                    </p>
                </section>

                <template v-if="currentStep === 3">
                    <section
                        class="relative z-20 rounded-lg bg-white/50 p-5 shadow-sm backdrop-blur-sm dark:bg-sand-800/60"
                    >
                        <PersonPicker
                            :persons="availablePersons"
                            :selected-ids="form.data.person_ids"
                            layout="grid"
                            @update:selected-ids="form.data.person_ids = $event"
                        />
                    </section>

                    <section
                        class="relative z-10 rounded-lg bg-white/50 p-5 shadow-sm backdrop-blur-sm dark:bg-sand-800/60"
                    >
                        <TagSelector
                            :available-tags="availableTags"
                            :selected-ids="form.data.tag_ids"
                            :error="form.errors.tag_ids"
                            @update:selected-ids="form.data.tag_ids = $event"
                        />
                    </section>
                </template>
            </div>

            <div
                class="sticky bottom-0 z-30 border-t border-sand-200 bg-white/95 backdrop-blur-md dark:border-sand-800 dark:bg-sand-900/95"
                :style="{
                    paddingBottom:
                        'max(var(--inset-bottom, 0px), env(safe-area-inset-bottom, 0px), 1.25rem)',
                }"
            >
                <div class="flex items-center justify-between gap-3 px-4 pt-3">
                    <button
                        type="button"
                        class="rounded-lg px-5 py-2.5 text-sand-700 transition active:bg-sand-100 dark:text-sand-200 dark:active:bg-sand-800"
                        @click="goBack"
                    >
                        {{ currentStep === 0 ? t('Cancel') : t('Back') }}
                    </button>
                    <button
                        type="button"
                        class="rounded-lg bg-teal px-7 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-40"
                        :disabled="!canAdvance || form.processing"
                        @click="goNext"
                    >
                        {{ primaryLabel }}
                    </button>
                </div>
            </div>
        </div>

        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-200"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition duration-150"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <div
                    v-if="showSourcePicker"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
                    @click.self="showSourcePicker = false"
                >
                    <Transition
                        enter-active-class="transition duration-200 ease-out"
                        enter-from-class="scale-95 opacity-0"
                        enter-to-class="scale-100 opacity-100"
                        leave-active-class="transition duration-150 ease-in"
                        leave-from-class="scale-100 opacity-100"
                        leave-to-class="scale-95 opacity-0"
                    >
                        <div
                            v-if="showSourcePicker"
                            class="w-full max-w-sm overflow-hidden rounded-lg bg-white dark:bg-sand-800"
                        >
                            <button
                                class="flex w-full items-center gap-3 px-5 py-4 text-left text-sand-700 active:bg-sand-50 dark:text-sand-200 dark:active:bg-sand-700"
                                @click="openCamera"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-5 bg-sand-500 dark:bg-sand-400"
                                    :style="iconMaskStyle(cameraIcon)"
                                ></span>
                                {{ t('Take a photo') }}
                            </button>
                            <div
                                class="mx-5 border-t border-sand-100 dark:border-sand-700"
                            />
                            <button
                                class="flex w-full items-center gap-3 px-5 py-4 text-left text-sand-700 active:bg-sand-50 dark:text-sand-200 dark:active:bg-sand-700"
                                @click="recordVideo"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-5 bg-sand-500 dark:bg-sand-400"
                                    :style="iconMaskStyle(videoCameraIcon)"
                                ></span>
                                {{ t('Record a video') }}
                            </button>
                            <div
                                class="mx-5 border-t border-sand-100 dark:border-sand-700"
                            />
                            <button
                                class="flex w-full items-center gap-3 px-5 py-4 text-left text-sand-700 active:bg-sand-50 dark:text-sand-200 dark:active:bg-sand-700"
                                @click="selectFromGallery"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-5 bg-sand-500 dark:bg-sand-400"
                                    :style="iconMaskStyle(photoIcon)"
                                ></span>
                                {{ t('Choose from gallery') }}
                            </button>
                            <div
                                class="border-t border-sand-100 dark:border-sand-700"
                            />
                            <button
                                class="w-full py-3.5 text-center font-semibold text-sand-500 active:bg-sand-50 dark:text-sand-400 dark:active:bg-sand-700"
                                @click="showSourcePicker = false"
                            >
                                {{ t('Cancel') }}
                            </button>
                        </div>
                    </Transition>
                </div>
            </Transition>
        </Teleport>

        <ImageCropModal
            :open="showCropModal"
            :src="mediaPreview"
            @update:open="showCropModal = $event"
            @cropped="handleCropped"
        />
    </AppLayout>
</template>
