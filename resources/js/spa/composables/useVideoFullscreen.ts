import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';

type FullscreenVideoElement = HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitExitFullscreen?: () => void;
};

export function useVideoFullscreen(
    videoRef: Ref<HTMLVideoElement | undefined>,
) {
    const isMuted = ref(true);
    const isFullscreen = ref(false);

    function toggleMute(): void {
        isMuted.value = !isMuted.value;

        if (videoRef.value) {
            videoRef.value.muted = isMuted.value;
        }
    }

    function toggleFullscreen(): void {
        const video = videoRef.value as FullscreenVideoElement | undefined;
        const next = !isFullscreen.value;
        isFullscreen.value = next;

        if (next) {
            if (video?.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();
            } else if (video?.requestFullscreen) {
                video.requestFullscreen().catch(() => {
                    /* fallback to in-DOM fullscreen */
                });
            }

            if (video) {
                video.muted = false;
                isMuted.value = false;
                video.play().catch(() => {
                    /* autoplay blocked */
                });
            }
        } else {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {
                    /* ignore */
                });
            } else if (video?.webkitExitFullscreen) {
                video.webkitExitFullscreen();
            }
        }
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && isFullscreen.value) {
            isFullscreen.value = false;
        }
    }

    function syncFullscreenFromBrowser(): void {
        isFullscreen.value = !!document.fullscreenElement;
    }

    // iOS' webkitEnterFullscreen() does not fire `fullscreenchange` on
    // document, only `webkitbeginfullscreen` / `webkitendfullscreen` on the
    // video element itself. Without this sync, isFullscreen=true gets stuck
    // when iOS' own "Done" button closes fullscreen, leaving
    // main.style.overflow at 'hidden' and the feed no longer scrollable.
    function onWebkitBeginFullscreen(): void {
        isFullscreen.value = true;
    }

    function onWebkitEndFullscreen(): void {
        isFullscreen.value = false;
    }

    watch(
        () => videoRef.value,
        (video, prevVideo) => {
            if (prevVideo) {
                prevVideo.removeEventListener(
                    'webkitbeginfullscreen',
                    onWebkitBeginFullscreen,
                );
                prevVideo.removeEventListener(
                    'webkitendfullscreen',
                    onWebkitEndFullscreen,
                );
            }

            if (video) {
                video.addEventListener(
                    'webkitbeginfullscreen',
                    onWebkitBeginFullscreen,
                );
                video.addEventListener(
                    'webkitendfullscreen',
                    onWebkitEndFullscreen,
                );
            }
        },
        { immediate: true },
    );

    watch(isFullscreen, (val) => {
        if (typeof document === 'undefined') {
            return;
        }

        const main = document.querySelector('main') as HTMLElement | null;

        if (main) {
            main.style.overflow = val ? 'hidden' : '';
        }

        document.body.style.overflow = val ? 'hidden' : '';
    });

    onMounted(() => {
        document.addEventListener('keydown', handleKeydown);
        document.addEventListener(
            'fullscreenchange',
            syncFullscreenFromBrowser,
        );
    });

    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeydown);
        document.removeEventListener(
            'fullscreenchange',
            syncFullscreenFromBrowser,
        );

        if (videoRef.value) {
            videoRef.value.removeEventListener(
                'webkitbeginfullscreen',
                onWebkitBeginFullscreen,
            );
            videoRef.value.removeEventListener(
                'webkitendfullscreen',
                onWebkitEndFullscreen,
            );
        }

        if (typeof document !== 'undefined') {
            const main = document.querySelector('main') as HTMLElement | null;

            if (main) {
                main.style.overflow = '';
            }

            document.body.style.overflow = '';
        }
    });

    return { isMuted, isFullscreen, toggleMute, toggleFullscreen };
}
