<script setup lang="ts">
import { Camera, Dialog, Edge, Events, Off, On } from '@nativephp/mobile';
import { NativeMedia } from '@innerr/native-media';
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
import { readExif } from '@/composables/useExif';
import type { ExifData } from '@/composables/useExif';
import MediaCarousel from '@/spa/components/MediaCarousel.vue';
import type { CarouselItem } from '@/spa/components/MediaCarousel.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import { useApiForm } from '@/spa/composables/useApiForm';
import { uploadInChunks } from '@/spa/composables/useChunkedUpload';

const ImageCropModal = defineAsyncComponent(
    () => import('@/components/ImageCropModal.vue'),
);
const TagSelector = defineAsyncComponent(
    () => import('@/spa/components/TagSelector.vue'),
);
const LocationPickerSheet = defineAsyncComponent(
    () => import('@/spa/components/LocationPickerSheet.vue'),
);
import { useTranslations } from '@/spa/composables/useTranslations';
import { api, ApiError } from '@/spa/http/apiClient';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
import { useDefaultCirclesStore } from '@/spa/stores/defaultCircles';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { useLocalThumbnailsStore } from '@/spa/stores/localThumbnails';
import { usePersonsStore } from '@/spa/stores/persons';
import { useTagsStore } from '@/spa/stores/tags';
import cameraIcon from '../../../svg/doodle-icons/camera.svg';
import cropIcon from '../../../svg/doodle-icons/crop.svg';
import photoIcon from '../../../svg/doodle-icons/photo.svg';
import videoCameraIcon from '../../../svg/doodle-icons/video-camera.svg';

interface Circle {
    id: string;
    name: string;
    photo?: string | null;
    members_count?: number;
    members_can_invite?: boolean;
    members_can_view_members?: boolean;
    is_owner?: boolean;
}

interface Tag {
    id: string;
    name: string;
    usage_count?: number;
}

interface Person {
    id: string;
    name: string;
    avatar?: string | null;
    avatar_thumbnail?: string | null;
    user_id?: string | null;
    circle_ids?: string[];
}

interface MediaItem {
    id: string;
    path: string;
    isVideo: boolean;
    mimeType: string;
    preview: string;
    thumbnail?: string;
    exif: ExifData;
    /** Token from NativeMedia.stage so we can release the staged copy. */
    stagedToken?: string;
}

const MAX_PHOTOS = 10;

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();
const feedCache = useFeedCacheStore();
const localThumbnails = useLocalThumbnailsStore();
const circlesStore = useCirclesStore();
const personsStore = usePersonsStore();
const tagsStore = useTagsStore();
const defaultCirclesStore = useDefaultCirclesStore();

const circles = computed<Circle[]>(() => circlesStore.items ?? []);
const defaultCircleIds = computed<string[]>(
    () => defaultCirclesStore.ids ?? [],
);
const availableTags = computed<Tag[]>(() => tagsStore.items ?? []);
const allPersons = computed<Person[]>(() => personsStore.items ?? []);
const availablePersons = computed<Person[]>(() => {
    const selected = form.data.circle_ids;

    if (selected.length === 0) {
        return [];
    }

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

const items = ref<MediaItem[]>([]);
const activeIndex = ref(0);

const form = useApiForm({
    media_paths: [] as string[],
    media_metadata: [] as ExifData[],
    caption: '',
    location: '' as string,
    latitude: null as number | null,
    longitude: null as number | null,
    circle_ids: [] as string[],
    tag_ids: [] as string[],
    person_ids: [] as string[],
});

const isLocationPickerOpen = ref(false);

// The picker opens centred on the first photo's EXIF position (if any) so the
// user starts near where the shot was taken, but their explicit pick wins.
const pickerLatitude = computed<number | null>(
    () => form.data.latitude ?? items.value[0]?.exif.latitude ?? null,
);
const pickerLongitude = computed<number | null>(
    () => form.data.longitude ?? items.value[0]?.exif.longitude ?? null,
);
const hasChosenLocation = computed(
    () => form.data.latitude !== null && form.data.longitude !== null,
);

function handleLocationConfirm(value: {
    latitude: number | null;
    longitude: number | null;
    location: string | null;
}): void {
    form.data.latitude = value.latitude;
    form.data.longitude = value.longitude;
    form.data.location = value.location ?? '';
}

const showSourcePicker = ref(false);
const showCropModal = ref(false);
const cropTargetIndex = ref(0);
const uploading = ref(false);
// Houdt de laatste failure-reason vast zodat we 'm in de Dialog kunnen tonen
// als appendItem voor een video stilletjes faalt op een echt device.
const videoFailureReason = ref<string | null>(null);

// Wizard-stappen: 0=media, 1=caption, 2=cirkels, 3=tags & personen.
const TOTAL_STEPS = 4;
const currentStep = ref(0);

const hasMedia = computed(() => items.value.length > 0);
const hasMetadata = computed(
    () => form.data.tag_ids.length > 0 || form.data.person_ids.length > 0,
);
const hasCircles = computed(() => form.data.circle_ids.length > 0);
const hasVideo = computed(() => items.value.some((i) => i.isVideo));
const canAddMore = computed(
    () => !hasVideo.value && items.value.length < MAX_PHOTOS,
);

watch(
    items,
    (next) => {
        form.data.media_paths = next.map((i) => i.path);
        form.data.media_metadata = next.map((i) => i.exif);

        if (activeIndex.value >= next.length) {
            activeIndex.value = Math.max(0, next.length - 1);
        }
    },
    { deep: true },
);

const canAdvance = computed(() => {
    if (uploading.value) {
        return false;
    }

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

const carouselItems = computed<CarouselItem[]>(() =>
    items.value.map((item) => ({
        id: item.id,
        url: item.preview,
        type: item.isVideo ? 'video' : 'image',
        thumbnail: item.thumbnail ?? null,
    })),
);

// Drop tagged persons that are no longer in any of the selected circles.
watch(
    () => form.data.circle_ids,
    () => {
        if (form.data.person_ids.length === 0) {
            return;
        }

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

    if (!canAdvance.value) {
        return;
    }

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
    const remaining = MAX_PHOTOS - items.value.length;

    if (remaining <= 0) {
        return;
    }

    // Chain volgt het patroon uit de mobile-camera README: images() ipv all()
    // omdat het iOS PHPicker filter `.any(of:)` icm selectionLimit > 1 op
    // sommige iOS-versies onbetrouwbaar in multi-select valt. Video's pakken
    // we via een aparte flow.
    await Camera.pickImages().images().multiple(true).maxItems(remaining);
}

async function selectVideoFromGallery(): Promise<void> {
    showSourcePicker.value = false;

    if (items.value.length > 0) {
        void Dialog.alert(
            t("Can't add a video"),
            t('Videos can only be shared on their own, without photos.'),
        );

        return;
    }

    // Video uit camera roll: single-select via .videos() — combineren met
    // photos in één picker is op iOS te onbetrouwbaar (zie selectFromGallery).
    await Camera.pickImages().videos().multiple(false).maxItems(1);
}

async function openCamera(): Promise<void> {
    showSourcePicker.value = false;
    await Camera.getPhoto();
}

async function recordVideo(): Promise<void> {
    showSourcePicker.value = false;

    if (items.value.length > 0) {
        void Dialog.alert(
            t("Can't add a video"),
            t('Videos can only be shared on their own, without photos.'),
        );

        return;
    }

    await Camera.recordVideo();
}

// Native staging: kopieert/hardlinkt het bestand naar `Documents/app/public/_media/`
// zodat de WebView het via de bestaande `/_assets/...` fast-path streamt
// (range-aware, chunked, no PHP roundtrip). Voorkomt de OOM-kill van het
// PHP-proces die optrad toen we videos als base64 door PHP probeerden te jagen.
async function stageMedia(
    path: string,
    mimeType: string,
): Promise<{ url: string; token: string } | null> {
    try {
        const result = await NativeMedia.stage(path, mimeType || undefined);
        console.log('[CreatePost media] staged', {
            path,
            url: result.url,
            mime: result.mime,
            sizeMb: +(result.size / 1024 / 1024).toFixed(2),
        });

        return { url: result.url, token: result.token };
    } catch (error) {
        console.error('[CreatePost media] stage failed', {
            path,
            error: String(error),
        });
        videoFailureReason.value = `stage failed: ${String(error)}`;

        return null;
    }
}

async function generateThumbnail(path: string): Promise<string | undefined> {
    try {
        const thumb = await NativeMedia.thumbnail(path, {
            maxSize: 512,
            timeSeconds: 0.1,
        });

        return thumb.dataUrl;
    } catch (error) {
        console.warn('[CreatePost media] thumbnail failed (non-fatal)', {
            path,
            error: String(error),
        });

        return undefined;
    }
}

async function fetchBlob(url: string): Promise<Blob | null> {
    try {
        const res = await fetch(url);

        if (!res.ok) {
            return null;
        }

        return await res.blob();
    } catch {
        return null;
    }
}

function makeItem(
    path: string,
    mimeType: string,
    preview: string,
    exif: ExifData,
    stagedToken: string,
    thumbnail?: string,
): MediaItem {
    return {
        id: crypto.randomUUID(),
        path,
        isVideo: mimeType.startsWith('video/'),
        mimeType,
        preview,
        thumbnail,
        exif,
        stagedToken,
    };
}

async function appendItem(path: string, mimeType: string): Promise<void> {
    const isVideo = mimeType.startsWith('video/');
    console.log('[CreatePost media] appendItem', {
        path,
        mimeType,
        isVideo,
        existingItems: items.value.length,
    });

    videoFailureReason.value = null;
    const staged = await stageMedia(path, mimeType);

    if (!staged) {
        const reason = videoFailureReason.value ?? 'unknown';
        void Dialog.alert(
            t(isVideo ? 'Could not load video' : 'Could not load photo'),
            t('Media preview failed: :reason', { reason }),
        );

        return;
    }

    let exif: ExifData = { taken_at: null, latitude: null, longitude: null };
    let thumbnail: string | undefined;

    if (isVideo) {
        thumbnail = await generateThumbnail(path);
    } else {
        // EXIF lezen we via een fetch op de staged URL — de WebView's asset
        // fast-path streamt het bestand zonder PHP-roundtrip.
        const blob = await fetchBlob(staged.url);

        if (blob) {
            exif = await readExif(blob);
        }
    }

    items.value.push(
        makeItem(path, mimeType, staged.url, exif, staged.token, thumbnail),
    );
    console.log('[CreatePost media] item pushed', {
        isVideo,
        totalItems: items.value.length,
        hasThumbnail: thumbnail !== undefined,
    });
}

async function handlePhotoTaken(payload: {
    path: string;
    mimeType: string;
}): Promise<void> {
    if (hasVideo.value || items.value.length >= MAX_PHOTOS) {
        return;
    }

    await appendItem(payload.path, payload.mimeType);
}

async function handleVideoRecorded(payload: {
    path: string;
    mimeType: string;
}): Promise<void> {
    console.log('[CreatePost video] VideoRecorded event', {
        path: payload?.path,
        mimeType: payload?.mimeType,
        existingItems: items.value.length,
    });

    if (items.value.length > 0) {
        console.warn(
            '[CreatePost video] VideoRecorded ignored: items already present',
        );

        return;
    }

    if (!payload?.path) {
        console.error('[CreatePost video] VideoRecorded payload missing path', {
            payload,
        });
        void Dialog.alert(
            t('Could not load video'),
            t('No file path returned from the camera.'),
        );

        return;
    }

    await appendItem(payload.path, payload.mimeType ?? '');
}

async function handleMediaSelected(payload: {
    success: boolean;
    files: { path: string; mimeType: string }[];
    cancelled: boolean;
}): Promise<void> {
    if (!payload.success || payload.cancelled || !payload.files.length) {
        return;
    }

    const hasIncomingVideo = payload.files.some((f) =>
        f.mimeType?.startsWith('video/'),
    );

    if (
        hasIncomingVideo &&
        (items.value.length > 0 || payload.files.length > 1)
    ) {
        void Dialog.alert(
            t("Can't combine media"),
            t('Videos can only be shared on their own, without photos.'),
        );

        return;
    }

    for (const file of payload.files) {
        if (items.value.length >= MAX_PHOTOS) {
            break;
        }

        await appendItem(file.path, file.mimeType ?? '');
    }
}

function removeItem(index: number): void {
    const [removed] = items.value.splice(index, 1);

    if (removed?.stagedToken) {
        void NativeMedia.release(removed.stagedToken);
    }

    if (items.value.length === 0) {
        activeIndex.value = 0;
    } else if (activeIndex.value >= items.value.length) {
        activeIndex.value = items.value.length - 1;
    }
}

function openCropModal(): void {
    const item = items.value[activeIndex.value];

    if (!item || item.isVideo) {
        return;
    }

    cropTargetIndex.value = activeIndex.value;
    showCropModal.value = true;
}

async function handleCropped(
    blob: Blob,
    dataUrl: string,
    exif: ExifData,
): Promise<void> {
    const target = items.value[cropTargetIndex.value];

    if (!target) {
        showCropModal.value = false;

        return;
    }

    uploading.value = true;

    try {
        const path = await uploadInChunks(blob, exif);

        // De originele staged kopie hoort niet meer bij het zichtbare beeld;
        // gooi 'm weg. De gecropte data-URL is klein genoeg om als preview te
        // gebruiken zonder nieuwe stage-call.
        if (target.stagedToken) {
            void NativeMedia.release(target.stagedToken);
            target.stagedToken = undefined;
        }

        target.path = path;
        target.preview = dataUrl;
        target.exif = exif;
        showCropModal.value = false;
    } catch {
        void Dialog.alert(
            t('Upload failed'),
            t('Could not upload the cropped photo. Please try again.'),
        );
    } finally {
        uploading.value = false;
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

    // Vrijgeven van eventuele resterende staged kopieen — als de gebruiker de
    // pagina verlaat zonder te posten, anders blijven ze op disk staan.
    for (const item of items.value) {
        if (item.stagedToken) {
            void NativeMedia.release(item.stagedToken);
        }
    }
});

function buildOptimisticPost(): PostData {
    const tempId = `optimistic-${crypto.randomUUID()}`;
    const first = items.value[0];
    const isVideo = first?.isVideo ?? false;
    const previewUrl = first?.preview ?? '';
    // Voor video gebruiken we de native gegenereerde JPEG-thumbnail als
    // poster terwijl de server de upload nog verwerkt — de video-URL zelf
    // kan op dat moment nog niet als afbeelding renderen.
    const firstPoster = isVideo ? (first?.thumbnail ?? previewUrl) : previewUrl;
    const selectedCircles = circles.value
        .filter((c) => form.data.circle_ids.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name, photo: c.photo ?? null }));

    return {
        id: tempId,
        media_url: previewUrl,
        media_type: isVideo ? 'video' : 'image',
        thumbnail_url: isVideo ? firstPoster : null,
        thumbnail_small_url: isVideo ? firstPoster : null,
        media_status: 'processing',
        media: items.value.map((item, index) => {
            const poster = item.isVideo
                ? (item.thumbnail ?? item.preview)
                : null;

            return {
                id: `${tempId}-${index}`,
                url: item.preview,
                type: item.isVideo ? 'video' : 'image',
                status: 'processing',
                thumbnail_url: poster,
                thumbnail_small_url: poster,
                sort_order: index,
            };
        }),
        caption: form.data.caption ?? null,
        location: form.data.location || null,
        created_at: new Date().toISOString(),
        user: {
            id: auth.user?.id ?? '',
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
    if (
        form.processing ||
        uploading.value ||
        !hasMedia.value ||
        !hasCircles.value
    ) {
        return;
    }

    const hasPreview = !!items.value[0]?.preview;
    const optimistic = hasPreview ? buildOptimisticPost() : null;
    const targetCircleIds = [...form.data.circle_ids];

    if (optimistic) {
        feedCache.prepend('home', optimistic);

        for (const circleId of targetCircleIds) {
            feedCache.prepend(`circle:${circleId}`, optimistic);
        }
    }

    router.push({ name: 'spa.home' });

    // De router.afterEach POST naar /api/spa/edge/active-tab herstelt de
    // native bottom-nav (die we in onMounted hebben gewist). Op de
    // single-threaded native PHP-runtime kan die fire-and-forget POST achter
    // de upload hieronder gequeued raken en bij netwerkdruk silently falen,
    // waardoor de gebruiker op de feed terechtkomt zonder bottom-nav. Doe
    // dezelfde call hier expliciet en wacht 'm af zodat de bar terug is
    // vóór de upload start; afterEach's tweede call is een no-op duplicate.
    await api.post('/api/spa/edge/active-tab', { path: '/' }).catch(() => null);

    try {
        // Pak de echte post-id uit de response en swap die in de cache zodat
        // de PostCard zijn id (de v-for key) behoudt over de eerstvolgende
        // softRefresh heen. Zonder deze swap remount Vue de hele PostCard van
        // `optimistic-…` naar `019e…` en flikkert de thumbnail weg tijdens
        // het laden van de CDN poster.
        let realPostId: string | undefined;

        await form.post<{ data: { id: string } }>('/api/spa/posts', {
            onSuccess: (response) => {
                realPostId = response?.data?.id;
            },
        });

        if (optimistic && realPostId) {
            const swapped: PostData = { ...optimistic, id: realPostId };
            feedCache.replaceById('home', optimistic.id, swapped);

            for (const circleId of targetCircleIds) {
                feedCache.replaceById(
                    `circle:${circleId}`,
                    optimistic.id,
                    swapped,
                );
            }

            // Bewaar de native gegenereerde thumbnail onder de echte post-id
            // zodat views die niet uit de feed-cache lezen (Profile, Notifications)
            // 'm als fallback kunnen pakken zolang de CDN poster nog niet
            // klaar is. Eerste item is bewust gekozen: Profile/Notifications
            // tonen één representatieve thumbnail per post.
            const firstThumbnail = items.value[0]?.thumbnail;

            if (firstThumbnail) {
                localThumbnails.set(realPostId, firstThumbnail);
            }
        } else {
            // Geen id terug? Val terug op het oude gedrag: cache leegmaken
            // zodat de eerstvolgende mount een verse fetch doet.
            feedCache.invalidate('home');

            for (const circleId of targetCircleIds) {
                feedCache.invalidate(`circle:${circleId}`);
            }
        }
    } catch (error) {
        if (optimistic) {
            feedCache.removeItem('home', optimistic.id);

            for (const circleId of targetCircleIds) {
                feedCache.removeItem(`circle:${circleId}`, optimistic.id);
            }
        }

        if (error instanceof ApiError && error.status === 429) {
            const seconds = error.retryAfterSeconds ?? 60;
            const wait =
                seconds === 1
                    ? t('Please try again in :count second.', { count: 1 })
                    : t('Please try again in :count seconds.', {
                          count: seconds,
                      });
            // Endpoint pad zonder query/host zodat de dialog leesbaar blijft.
            const endpoint = error.url
                ? (() => {
                      try {
                          return new URL(error.url, window.location.origin)
                              .pathname;
                      } catch {
                          return error.url;
                      }
                  })()
                : '/api/spa/posts';

            const message = `${wait}\n\n${t('Endpoint: :endpoint', { endpoint })}`;

            void Dialog.alert(t('Slow down a moment'), message);
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

const activeItemIsImage = computed(() => {
    const item = items.value[activeIndex.value];

    return item ? !item.isVideo : false;
});
</script>

<template>
    <AppLayout :title="t('New post')">
        <template #header-left>
            <button
                class="flex items-center text-ink"
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
            <div class="shrink-0 px-4 pt-4">
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
                                ? 'w-8 bg-action'
                                : step - 1 < currentStep
                                  ? 'w-4 bg-action/60'
                                  : 'w-4 bg-sand-200'
                        "
                    />
                </div>
                <p
                    class="mt-3 text-center tracking-widest text-ink-muted uppercase"
                >
                    {{
                        t('Step :current of :total', {
                            current: currentStep + 1,
                            total: TOTAL_STEPS,
                        })
                    }}
                </p>
                <h2
                    class="mt-1 text-center font-display text-2xl font-semibold text-ink"
                >
                    {{ stepHeading }}
                </h2>
                <p class="mt-1 text-center text-ink-muted">
                    {{ stepSubtitle }}
                </p>
            </div>

            <div class="relative mt-6 flex-1 space-y-5 px-4 pb-6">
                <section
                    v-show="currentStep === 0"
                    class="overflow-hidden rounded-lg bg-surface/50 shadow-sm backdrop-blur-sm"
                >
                    <div
                        v-if="hasMedia"
                        class="relative aspect-square overflow-hidden"
                    >
                        <MediaCarousel
                            :items="carouselItems"
                            :active-index="activeIndex"
                            @update:active-index="activeIndex = $event"
                        />

                        <p
                            v-if="items.length > 1"
                            class="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm"
                        >
                            {{
                                t('Photo :index of :total', {
                                    index: activeIndex + 1,
                                    total: items.length,
                                })
                            }}
                        </p>

                        <button
                            v-if="activeItemIsImage"
                            class="absolute top-3 left-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                            :aria-label="t('Crop photo')"
                            :disabled="uploading"
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
                            :aria-label="t('Remove this photo')"
                            :disabled="uploading"
                            @click="removeItem(activeIndex)"
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

                        <button
                            v-if="canAddMore"
                            class="absolute right-3 bottom-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-2 text-xs text-white backdrop-blur-sm"
                            :disabled="uploading"
                            @click="openSourcePicker"
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
                                    d="M12 4.5v15m7.5-7.5h-15"
                                />
                            </svg>
                            {{ t('Add more') }}
                        </button>
                    </div>

                    <button
                        v-else
                        class="flex w-full flex-col items-center justify-center gap-3 px-8 py-14 active:bg-sand-100/40"
                        @click="openSourcePicker"
                    >
                        <div
                            class="flex size-20 items-center justify-center rounded-2xl bg-success-soft text-ink dark:bg-surface"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-10 bg-current"
                                :style="iconMaskStyle(cameraIcon)"
                            ></span>
                        </div>
                        <span class="text-ink-muted">{{
                            t('Add a photo')
                        }}</span>
                    </button>

                    <p
                        v-if="form.errors.media_path || form.errors.media_paths"
                        class="px-5 pb-4 text-destructive-ink"
                    >
                        {{ form.errors.media_path || form.errors.media_paths }}
                    </p>
                </section>

                <section
                    v-show="currentStep === 1"
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <label
                        for="post-caption"
                        class="tracking-wider text-ink-muted uppercase"
                    >
                        {{ t('Caption') }}
                    </label>
                    <textarea
                        id="post-caption"
                        v-model="form.data.caption"
                        :placeholder="t('Write a caption...')"
                        rows="6"
                        maxlength="2200"
                        class="mt-2 w-full resize-none border-0 bg-transparent p-0 text-base text-ink placeholder-ink-muted/60 focus:ring-0 focus:outline-none"
                    />
                    <p
                        v-if="form.errors.caption"
                        class="mt-1 text-destructive-ink"
                    >
                        {{ form.errors.caption }}
                    </p>
                </section>

                <section
                    v-show="currentStep === 1"
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <span class="tracking-wider text-ink-muted uppercase">
                        {{ t('Location') }}
                    </span>
                    <button
                        type="button"
                        class="mt-2 flex w-full items-center gap-3 text-left"
                        @click="isLocationPickerOpen = true"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.75"
                            class="size-5 shrink-0 text-ink-muted"
                            aria-hidden="true"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                            />
                        </svg>
                        <span class="min-w-0 flex-1">
                            <span
                                v-if="hasChosenLocation"
                                class="block truncate text-ink"
                            >
                                {{ form.data.location || t('Pinned location') }}
                            </span>
                            <span v-else class="block text-ink-muted">
                                {{ t('Add a location') }}
                            </span>
                        </span>
                        <span class="shrink-0 font-medium text-action">
                            {{ hasChosenLocation ? t('Change') : t('Add') }}
                        </span>
                    </button>
                </section>

                <section
                    v-show="currentStep === 2"
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <CirclePicker
                        v-if="circles.length > 0"
                        :circles="circles"
                        :selected-ids="form.data.circle_ids"
                        :error="form.errors.circle_ids"
                        layout="grid"
                        @update:selected-ids="form.data.circle_ids = $event"
                    />
                    <p v-else class="text-ink-muted">
                        {{
                            t(
                                'Create a circle to set it as a default for new posts.',
                            )
                        }}
                    </p>
                </section>

                <template v-if="currentStep === 3">
                    <section
                        class="relative z-20 rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                    >
                        <PersonPicker
                            :persons="availablePersons"
                            :selected-ids="form.data.person_ids"
                            layout="grid"
                            @update:selected-ids="form.data.person_ids = $event"
                        />
                    </section>

                    <section
                        class="relative z-10 rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
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
                class="sticky bottom-0 z-30 border-t border-sand-200 bg-surface/95 backdrop-blur-md"
                :style="{
                    paddingBottom:
                        'max(var(--inset-bottom, 0px), env(safe-area-inset-bottom, 0px), 1.25rem)',
                }"
            >
                <div class="flex items-center justify-between gap-3 px-4 pt-3">
                    <button
                        type="button"
                        class="rounded-lg px-5 py-2.5 text-ink transition active:bg-sand-100"
                        @click="goBack"
                    >
                        {{ currentStep === 0 ? t('Cancel') : t('Back') }}
                    </button>
                    <button
                        type="button"
                        class="rounded-lg bg-action px-7 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
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
                            class="w-full max-w-sm overflow-hidden rounded-lg bg-surface"
                        >
                            <button
                                class="flex w-full items-center gap-3 px-5 py-4 text-left text-ink active:bg-sand-50"
                                @click="openCamera"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-5 bg-action dark:bg-ink"
                                    :style="iconMaskStyle(cameraIcon)"
                                ></span>
                                {{ t('Take a photo') }}
                            </button>
                            <template v-if="items.length === 0">
                                <div class="mx-5 border-t border-sand-100" />
                                <button
                                    class="flex w-full items-center gap-3 px-5 py-4 text-left text-ink active:bg-sand-50"
                                    @click="recordVideo"
                                >
                                    <span
                                        aria-hidden="true"
                                        class="inline-block size-5 bg-action dark:bg-ink"
                                        :style="iconMaskStyle(videoCameraIcon)"
                                    ></span>
                                    {{ t('Record a video') }}
                                </button>
                            </template>
                            <div class="mx-5 border-t border-sand-100" />
                            <button
                                class="flex w-full items-center gap-3 px-5 py-4 text-left text-ink active:bg-sand-50"
                                @click="selectFromGallery"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-5 bg-action dark:bg-ink"
                                    :style="iconMaskStyle(photoIcon)"
                                ></span>
                                {{
                                    items.length === 0
                                        ? t('Choose photos from gallery')
                                        : t('Choose from gallery')
                                }}
                            </button>
                            <template v-if="items.length === 0">
                                <div class="mx-5 border-t border-sand-100" />
                                <button
                                    class="flex w-full items-center gap-3 px-5 py-4 text-left text-ink active:bg-sand-50"
                                    @click="selectVideoFromGallery"
                                >
                                    <span
                                        aria-hidden="true"
                                        class="inline-block size-5 bg-action dark:bg-ink"
                                        :style="iconMaskStyle(videoCameraIcon)"
                                    ></span>
                                    {{ t('Choose video from gallery') }}
                                </button>
                            </template>
                            <div class="border-t border-sand-100" />
                            <button
                                class="w-full py-3.5 text-center font-semibold text-ink-muted active:bg-sand-50"
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
            :src="items[cropTargetIndex]?.preview ?? null"
            @update:open="showCropModal = $event"
            @cropped="handleCropped"
        />

        <LocationPickerSheet
            :open="isLocationPickerOpen"
            :latitude="pickerLatitude"
            :longitude="pickerLongitude"
            :location="form.data.location || null"
            @update:open="isLocationPickerOpen = $event"
            @confirm="handleLocationConfirm"
        />
    </AppLayout>
</template>
