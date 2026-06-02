import { ref, watch, onUnmounted } from 'vue';
import type { Ref } from 'vue';

interface PullToRefreshOptions {
    onRefresh: () => Promise<void>;
    threshold?: number;
    maxPull?: number;
    containerRef: Ref<HTMLElement | null>;
}

export function usePullToRefresh({
    onRefresh,
    threshold = 80,
    maxPull = 120,
    containerRef,
}: PullToRefreshOptions) {
    const pullDistance = ref(0);
    const isRefreshing = ref(false);

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let activated = false;
    let boundTarget: HTMLElement | null = null;

    const ACTIVATION_THRESHOLD = 10;

    function onTouchStart(e: TouchEvent) {
        if (isRefreshing.value) {
            return;
        }

        // Reset any stale state from a previously interrupted gesture
        pullDistance.value = 0;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
        activated = false;
    }

    function onTouchMove(e: TouchEvent) {
        if (!tracking || isRefreshing.value) {
            return;
        }

        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const diffY = currentY - startY;
        const diffX = currentX - startX;
        const scrollTop = containerRef.value?.scrollTop ?? 0;

        if (!activated) {
            if (scrollTop > 0) {
                startY = currentY;
                startX = currentX;

                return;
            }

            // Require a clear vertical-down gesture before activating, so
            // ordinary scroll / horizontal swipes are not hijacked.
            if (
                diffY <= ACTIVATION_THRESHOLD ||
                Math.abs(diffY) <= Math.abs(diffX)
            ) {
                return;
            }

            activated = true;
            startY = currentY - ACTIVATION_THRESHOLD;
        }

        const distance = (currentY - startY) * 0.5;
        pullDistance.value = Math.min(Math.max(distance, 0), maxPull);

        if (pullDistance.value > 0) {
            e.preventDefault();
        }
    }

    async function onTouchEnd() {
        if (!tracking || isRefreshing.value) {
            return;
        }

        tracking = false;

        if (activated && pullDistance.value >= threshold) {
            isRefreshing.value = true;
            pullDistance.value = threshold * 0.6;

            // Safety timeout: reset if the refresh promise never resolves
            // (e.g. network error that doesn't trigger onFinish)
            const safetyTimer = setTimeout(() => {
                isRefreshing.value = false;
                pullDistance.value = 0;
                tracking = false;
                activated = false;
            }, 15_000);

            try {
                await onRefresh();
            } finally {
                clearTimeout(safetyTimer);
                isRefreshing.value = false;
                pullDistance.value = 0;
                tracking = false;
                activated = false;
            }
        } else {
            pullDistance.value = 0;
            activated = false;
        }
    }

    function onTouchCancel() {
        tracking = false;
        activated = false;
        pullDistance.value = 0;
    }

    function bind(el: HTMLElement) {
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('touchcancel', onTouchCancel, { passive: true });
        boundTarget = el;
    }

    function unbind() {
        if (!boundTarget) {
            return;
        }

        boundTarget.removeEventListener('touchstart', onTouchStart);
        boundTarget.removeEventListener('touchmove', onTouchMove);
        boundTarget.removeEventListener('touchend', onTouchEnd);
        boundTarget.removeEventListener('touchcancel', onTouchCancel);
        boundTarget = null;
    }

    watch(
        containerRef,
        (el, oldEl) => {
            if (oldEl) {
                unbind();
            }

            if (el) {
                bind(el);
            }
        },
        { immediate: true },
    );

    onUnmounted(unbind);

    return {
        pullDistance,
        isRefreshing,
    };
}
