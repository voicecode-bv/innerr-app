import { onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { haptics } from '@/spa/services/haptics';

interface Options {
    onRefresh: () => Promise<void>;
    containerRef: Ref<HTMLElement | null>;
    threshold?: number;
}

export function usePullToRefresh(options: Options) {
    const pullDistance = ref(0);
    const isRefreshing = ref(false);

    const threshold = options.threshold ?? 80;
    let startY = 0;
    let active = false;
    let attached: HTMLElement | null = null;
    let didArm = false;

    function onTouchStart(event: TouchEvent): void {
        if (!attached || attached.scrollTop > 0 || isRefreshing.value) {
            active = false;

            return;
        }

        startY = event.touches[0].clientY;
        active = true;
        didArm = false;
    }

    function onTouchMove(event: TouchEvent): void {
        if (!active) {
            return;
        }

        const delta = event.touches[0].clientY - startY;

        if (delta <= 0) {
            pullDistance.value = 0;

            return;
        }

        pullDistance.value = Math.min(delta, threshold * 1.5);

        // Haptic tick the moment the threshold is crossed, the way native
        // iOS pull-to-refresh arms itself.
        if (!didArm && pullDistance.value >= threshold) {
            didArm = true;
            haptics.impactLight();
        }
    }

    async function onTouchEnd(): Promise<void> {
        if (!active) {
            return;
        }

        active = false;

        if (pullDistance.value >= threshold) {
            isRefreshing.value = true;

            try {
                await options.onRefresh();
            } finally {
                isRefreshing.value = false;
                pullDistance.value = 0;
            }
        } else {
            pullDistance.value = 0;
        }
    }

    function detach(): void {
        if (!attached) {
            return;
        }

        attached.removeEventListener('touchstart', onTouchStart);
        attached.removeEventListener('touchmove', onTouchMove);
        attached.removeEventListener('touchend', onTouchEnd);
        attached = null;
    }

    function attach(element: HTMLElement): void {
        detach();
        attached = element;
        attached.addEventListener('touchstart', onTouchStart, {
            passive: true,
        });
        attached.addEventListener('touchmove', onTouchMove, { passive: true });
        attached.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    watch(
        () => options.containerRef.value,
        (element) => {
            if (element) {
                attach(element);
            } else {
                detach();
            }
        },
        { immediate: true },
    );

    onUnmounted(detach);

    return { pullDistance, isRefreshing };
}
