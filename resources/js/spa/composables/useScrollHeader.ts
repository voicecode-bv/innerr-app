import { onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';

/**
 * Scroll-aware header treatment: mark the header "elevated" (translucent +
 * blur) as soon as content is scrolled underneath it. The header itself
 * always stays in place.
 */

export interface ScrollHeaderState {
    elevated: Ref<boolean>;
    onScrollTop: (scrollTop: number) => void;
}

/** Pure state, separated from the DOM so it can be unit tested. */
export function createScrollHeaderState(): ScrollHeaderState {
    const elevated = ref(false);

    function onScrollTop(scrollTop: number): void {
        elevated.value = scrollTop > 0;
    }

    return { elevated, onScrollTop };
}

/**
 * Bind the state to a scroll container (rAF-throttled). Rebinds when the
 * container ref changes (AppLayout's main mounts after first render).
 */
export function useScrollHeader(
    containerRef: Ref<HTMLElement | null>,
): ScrollHeaderState {
    const state = createScrollHeaderState();

    let attached: HTMLElement | null = null;
    let rafHandle = 0;

    function onScroll(): void {
        if (rafHandle) {
            return;
        }

        rafHandle = requestAnimationFrame(() => {
            rafHandle = 0;

            if (attached) {
                state.onScrollTop(attached.scrollTop);
            }
        });
    }

    function detach(): void {
        attached?.removeEventListener('scroll', onScroll);
        attached = null;

        if (rafHandle) {
            cancelAnimationFrame(rafHandle);
            rafHandle = 0;
        }
    }

    watch(
        containerRef,
        (el) => {
            detach();

            if (el) {
                attached = el;
                el.addEventListener('scroll', onScroll, { passive: true });
                state.onScrollTop(el.scrollTop);
            }
        },
        { immediate: true },
    );

    onUnmounted(detach);

    return state;
}
