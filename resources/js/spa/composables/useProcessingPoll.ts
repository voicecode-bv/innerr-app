import { computed, onUnmounted, watch } from 'vue';
import type { Ref } from 'vue';

/**
 * Item shape we care about: anything with an optional `media_status` field.
 */
interface ProcessingAware {
    media_status?: 'processing' | 'ready' | 'failed';
}

interface Options {
    /** Poll interval in ms while at least one item is processing. */
    intervalMs?: number;
    /**
     * Stop polling after this many ms even if items are still processing —
     * server-side transcoding can stall and we don't want a runaway timer.
     */
    timeoutMs?: number;
}

/**
 * Watch a feed's items for any in `media_status === 'processing'` state. While
 * any are present, call `refresh()` every `intervalMs`. Self-stops when the
 * processing items resolve, on timeout, or on component unmount.
 *
 * Use case: after a video upload the server creates the post immediately with
 * `media_status: 'processing'` and transcodes asynchronously. Without polling
 * the SPA's feed cache stays on 'processing' until the user manually pulls to
 * refresh — even though the video is already playable.
 */
export function useProcessingPoll<T extends ProcessingAware>(
    items: Ref<readonly T[]>,
    refresh: () => Promise<unknown> | unknown,
    { intervalMs = 5000, timeoutMs = 5 * 60 * 1000 }: Options = {},
): void {
    const hasProcessing = computed(() =>
        items.value.some((item) => item.media_status === 'processing'),
    );

    let intervalHandle: ReturnType<typeof setInterval> | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let startedAt = 0;

    function stop(): void {
        if (intervalHandle !== null) {
            clearInterval(intervalHandle);
            intervalHandle = null;
        }

        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
        }
    }

    function start(): void {
        if (intervalHandle !== null) {
            return;
        }

        startedAt = Date.now();
        intervalHandle = setInterval(() => {
            // Guard tegen overlappende refreshes: als de vorige nog loopt
            // (langzame verbinding) wachten we tot 'ie klaar is.
            if (inFlight) {
                return;
            }

            // Globale veiligheidsstop: stoppen na de timeout, ook als de
            // server nog niet klaar is — voorkomt een eeuwig draaiende timer.
            if (Date.now() - startedAt > timeoutMs) {
                stop();

                return;
            }

            inFlight = true;
            void Promise.resolve(refresh()).finally(() => {
                inFlight = false;
            });
        }, intervalMs);
    }

    watch(
        hasProcessing,
        (any) => {
            if (any) {
                start();
            } else {
                stop();
            }
        },
        { immediate: true },
    );

    onUnmounted(stop);
}
