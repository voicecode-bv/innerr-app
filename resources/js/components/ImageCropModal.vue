<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import BottomSheet from '@/components/BottomSheet.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { readExif, type ExifData } from '@/composables/useExif';
import 'vue-advanced-cropper/dist/style.css';

type Ratio = '1:1' | '5:4';

const props = defineProps<{
    open: boolean;
    src: string | null;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'cropped', blob: Blob, dataUrl: string, exif: ExifData): void;
}>();

const { t } = useTranslations();

const cropperRef = useTemplateRef<InstanceType<typeof Cropper>>('cropperRef');
const ratio = ref<Ratio>('1:1');
const processing = ref(false);

const aspectRatio = computed<number>(() => (ratio.value === '1:1' ? 1 : 5 / 4));

const stencilProps = computed(() => ({
    aspectRatio: aspectRatio.value,
    movable: true,
    resizable: true,
}));

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) {
            ratio.value = '1:1';
            processing.value = false;
        }
    },
);

function close() {
    if (processing.value) {
        return;
    }

    emit('update:open', false);
}

function onSheetUpdate(value: boolean) {
    if (!value) {
        close();
    } else {
        emit('update:open', true);
    }
}

const MAX_OUTPUT_DIMENSION = 2048;

async function confirm() {
    const instance = cropperRef.value;

    if (!instance || processing.value) {
        return;
    }

    const result = instance.getResult();
    const sourceCanvas = result.canvas;

    if (!sourceCanvas) {
        return;
    }

    const longest = Math.max(sourceCanvas.width, sourceCanvas.height);
    const scale =
        longest > MAX_OUTPUT_DIMENSION ? MAX_OUTPUT_DIMENSION / longest : 1;

    let canvas: HTMLCanvasElement;

    if (scale < 1) {
        canvas = document.createElement('canvas');
        canvas.width = Math.round(sourceCanvas.width * scale);
        canvas.height = Math.round(sourceCanvas.height * scale);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return;
        }

        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    } else {
        canvas = sourceCanvas;
    }

    processing.value = true;

    // Read EXIF from the ORIGINAL source before encoding the cropped canvas —
    // canvas.toBlob() re-encodes JPEG and strips EXIF.
    const exif = props.src
        ? await readExif(props.src)
        : { taken_at: null, latitude: null, longitude: null };

    canvas.toBlob(
        (blob) => {
            if (!blob) {
                processing.value = false;

                return;
            }

            const dataUrl = URL.createObjectURL(blob);
            emit('cropped', blob, dataUrl, exif);
        },
        'image/jpeg',
        0.85,
    );
}

const ratios: { value: Ratio; label: string }[] = [
    { value: '1:1', label: '1:1' },
    { value: '5:4', label: '5:4' },
];
</script>

<template>
    <BottomSheet :open="open" @update:open="onSheetUpdate">
        <template #header>
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-teal">
                    {{ t('Crop photo') }}
                </h2>
                <button
                    class="text-sand-500"
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

        <div class="flex flex-col gap-4 px-4 py-4">
            <div class="flex flex-wrap gap-2">
                <button
                    v-for="option in ratios"
                    :key="option.value"
                    class="rounded-full px-4 py-2 transition-colors"
                    :class="
                        ratio === option.value
                            ? 'bg-teal text-white shadow-sm'
                            : 'bg-sand-100 text-sand-700'
                    "
                    @click="ratio = option.value"
                >
                    {{ option.label }}
                </button>
            </div>

            <div class="overflow-hidden rounded-lg bg-black">
                <Cropper
                    v-if="src"
                    ref="cropperRef"
                    :src="src"
                    :stencil-props="stencilProps"
                    image-restriction="fit-area"
                    class="h-[55dvh] w-full"
                />
            </div>
        </div>

        <template #footer>
            <div class="flex gap-3 px-4 py-3">
                <button
                    class="flex-1 rounded-lg bg-sand-100 py-3 font-semibold text-sand-700 transition-colors"
                    :disabled="processing"
                    @click="close"
                >
                    {{ t('Cancel') }}
                </button>
                <button
                    class="flex-1 rounded-lg bg-teal py-3 font-semibold text-white shadow-sm transition-colors hover:bg-teal-light disabled:opacity-40"
                    :disabled="processing || !src"
                    @click="confirm"
                >
                    {{ processing ? t('Cropping...') : t('Crop') }}
                </button>
            </div>
        </template>
    </BottomSheet>
</template>
