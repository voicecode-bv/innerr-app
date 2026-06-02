<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

// HLS-aware video element. iOS Safari/WKWebView speelt `.m3u8` native af, dus
// daar zetten we gewoon `<video src>`. Andere browsers (Chrome/Firefox/Edge)
// hebben hls.js nodig — die wordt lazy geïmporteerd zodat de iOS-bundle slank
// blijft.
//
// Voor niet-HLS URLs (legacy `.mp4` posts of CDN poster paden) is dit een
// dunne wrapper rondom een `<video>` element; alle event-handling delegeren
// we via `<slot>` en attribute-binding zodat de wrapper drop-in vervangbaar is.

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
    // Match `.m3u8` met optionele query string (signed URLs voegen `?token=...` toe).
    return /\.m3u8(\?|$)/i.test(url);
}

async function attachSource(
    video: HTMLVideoElement,
    src: string,
): Promise<void> {
    // Eerdere hls.js instance opruimen voordat we een nieuwe bron koppelen,
    // anders blijven worker-threads draaien en groeit het geheugen elke
    // route-wissel.
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }

    if (!isHlsUrl(src)) {
        video.src = src;

        return;
    }

    // Safari en iOS WKWebView decoden HLS native via AVFoundation. We
    // forceren `crossorigin="anonymous"` zodat seekable tracks ook werken
    // bij signed Bunny URLs (zonder cookies); de signed token zit in de URL.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;

        return;
    }

    try {
        const { default: Hls } = await import('hls.js');

        if (!Hls.isSupported()) {
            // Geen native HLS en geen MSE — fallback naar directe src en hopen
            // dat de browser er iets mee kan (zal meestal falen, maar dan vuurt
            // tenminste het error-event ipv stille hang).
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
