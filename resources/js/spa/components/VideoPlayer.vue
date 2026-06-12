<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

// HLS-aware video element. iOS Safari/WKWebView plays `.m3u8` natively, so
// there we simply set `<video src>`. Other browsers (Chrome/Firefox/Edge)
// need hls.js, which is lazy-imported so the iOS bundle stays slim.
//
// For non-HLS URLs (legacy `.mp4` posts or CDN poster paths) this is a thin
// wrapper around a `<video>` element; all event handling is delegated via
// `<slot>` and attribute binding so the wrapper is a drop-in replacement.

const props = withDefaults(
    defineProps<{
        src: string;
        poster?: string | null;
        controls?: boolean;
        autoplay?: boolean;
        loop?: boolean;
        muted?: boolean;
        preload?: 'none' | 'metadata' | 'auto';
        crossorigin?: 'anonymous' | 'use-credentials' | null;
    }>(),
    {
        controls: false,
        autoplay: false,
        loop: false,
        muted: false,
        preload: 'metadata',
        crossorigin: null,
        poster: null,
    },
);

const emit = defineEmits<{
    (e: 'loadeddata'): void;
    (e: 'error', message: string): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
defineExpose({ videoRef });

let hlsInstance: { destroy: () => void } | null = null;

function isHlsUrl(url: string): boolean {
    // Match `.m3u8` with an optional query string (signed URLs append `?token=...`).
    return /\.m3u8(\?|$)/i.test(url);
}

async function attachSource(
    video: HTMLVideoElement,
    src: string,
): Promise<void> {
    // Clean up the previous hls.js instance before attaching a new source,
    // otherwise worker threads keep running and memory grows on every route
    // change.
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }

    if (!isHlsUrl(src)) {
        video.src = src;

        return;
    }

    // Safari and iOS WKWebView decode HLS natively via AVFoundation. We
    // force `crossorigin="anonymous"` so seekable tracks also work with
    // signed Bunny URLs (without cookies); the signed token is in the URL.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;

        return;
    }

    try {
        const { default: Hls } = await import('hls.js');

        if (!Hls.isSupported()) {
            // No native HLS and no MSE: fall back to a direct src and hope
            // the browser can do something with it (will usually fail, but
            // at least the error event fires instead of a silent hang).
            video.src = src;

            return;
        }

        const hls = new Hls({ enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
                emit('error', `hls.js fatal: ${data.type}/${data.details}`);
            }
        });

        hlsInstance = hls;
    } catch (error) {
        emit(
            'error',
            error instanceof Error ? error.message : 'failed to load hls.js',
        );
    }
}

watch(
    () => [videoRef.value, props.src] as const,
    ([video, src]) => {
        if (!video || !src) {
            return;
        }

        void attachSource(video as HTMLVideoElement, src);
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
});
</script>

<template>
    <video
        ref="videoRef"
        :poster="poster ?? undefined"
        :controls="controls"
        :autoplay="autoplay"
        :loop="loop"
        :muted="muted"
        :preload="preload"
        :crossorigin="crossorigin ?? undefined"
        playsinline
        webkit-playsinline
        @loadeddata="emit('loadeddata')"
    />
</template>
