import { onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isPostDetailRoute } from '@/spa/composables/postDetailOverlay';
import { hasOpenOverlay } from '@/spa/composables/useBackgroundScale';
import { resolveActiveTab } from '@/spa/composables/useBottomNav';
import {
    navTracker,
    suppressNextTransition,
} from '@/spa/composables/useNavDirection';
import { haptics } from '@/spa/services/haptics';
import {
    createVelocityTracker,
    prefersReducedMotion,
    settleDurationMs,
} from '@/spa/services/motion';

/**
 * iOS edge-swipe back. The native back-swipe is lost on iOS because the SPA
 * runs on in-memory history (php:// scheme), so we rebuild it: a drag from
 * the left screen edge tracks the finger with the whole page, and a committed
 * release animates the page off-screen before popping the route. The route
 * swap itself is suppressed to an instant switch — the gesture already played
 * the exit animation.
 *
 * Only active on stacked views: tab roots keep the edge for the drawer, the
 * post detail overlay has its own dismissal, and guest/onboarding flows
 * manage their own navigation.
 */

// Same edge width the drawer uses for its open gesture.
const EDGE_ZONE = 24;
// Movement before committing to a horizontal (back) vs vertical (scroll) axis.
const AXIS_THRESHOLD = 8;
// Fraction of the viewport the page must be dragged to commit on a slow release.
const COMMIT_FRACTION = 1 / 3;
// A flick past this velocity (px/ms) commits regardless of position.
const FLICK_VELOCITY = 0.5;

function isMemoryHistoryRuntime(): boolean {
    return typeof window !== 'undefined' && window.location.protocol === 'php:';
}

export function useEdgeSwipeBack(containerRef: Ref<HTMLElement | null>) {
    const router = useRouter();
    const route = useRoute();
    const velocityTracker = createVelocityTracker();

    let touchId: number | null = null;
    let candidate = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    function eligible(): boolean {
        return (
            isMemoryHistoryRuntime() &&
            navTracker.canGoBack() &&
            !hasOpenOverlay.value &&
            resolveActiveTab(route.path) === '' &&
            !isPostDetailRoute(route) &&
            route.meta.guest !== true &&
            !route.path.startsWith('/onboarding/')
        );
    }

    function setTransform(x: number, transition: string): void {
        const el = containerRef.value;

        if (!el) {
            return;
        }

        el.style.transition = transition;
        el.style.transform = x === 0 ? '' : `translateX(${x}px)`;
        el.style.boxShadow = x > 0 ? '-8px 0 24px rgba(0, 0, 0, 0.18)' : '';
    }

    function clearInlineStyles(): void {
        const el = containerRef.value;

        if (!el) {
            return;
        }

        // The container carries a class-based transform transition (background
        // scale effect); suppress it for a frame so this reset is instant
        // instead of animating the new page in from the side.
        el.style.transition = 'none';
        el.style.transform = '';
        el.style.boxShadow = '';
        requestAnimationFrame(() => {
            el.style.transition = '';
        });
    }

    function activeTouch(event: TouchEvent): Touch | null {
        for (const touch of Array.from(event.touches)) {
            if (touch.identifier === touchId) {
                return touch;
            }
        }

        return null;
    }

    function onTouchStart(event: TouchEvent): void {
        if (
            touchId !== null ||
            event.touches.length !== 1 ||
            event.touches[0].clientX > EDGE_ZONE ||
            !eligible()
        ) {
            return;
        }

        const touch = event.touches[0];
        touchId = touch.identifier;
        candidate = true;
        dragging = false;
        startX = touch.clientX;
        startY = touch.clientY;
        velocityTracker.start(touch.clientX);
    }

    function onTouchMove(event: TouchEvent): void {
        if (!candidate) {
            return;
        }

        const touch = activeTouch(event);

        if (!touch) {
            return;
        }

        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        velocityTracker.move(touch.clientX);

        if (!dragging) {
            if (
                Math.abs(dx) < AXIS_THRESHOLD &&
                Math.abs(dy) < AXIS_THRESHOLD
            ) {
                return;
            }

            // Vertical intent or a leftward move: not a back gesture.
            if (Math.abs(dy) > Math.abs(dx) || dx < 0) {
                candidate = false;
                touchId = null;

                return;
            }

            dragging = true;
        }

        // We own the gesture: the page follows the finger.
        event.preventDefault();
        setTransform(Math.max(0, dx), 'none');
    }

    function onTouchEnd(event: TouchEvent): void {
        if (!candidate) {
            return;
        }

        // Only finish when our tracked touch actually lifted.
        if (activeTouch(event)) {
            return;
        }

        const wasDragging = dragging;
        candidate = false;
        dragging = false;
        touchId = null;

        if (!wasDragging) {
            return;
        }

        const el = containerRef.value;
        const width = el?.offsetWidth ?? window.innerWidth;
        const offset = getCurrentOffset(el);
        const releaseVelocity = velocityTracker.velocity();
        const commit =
            offset > width * COMMIT_FRACTION ||
            (releaseVelocity > FLICK_VELOCITY && offset > EDGE_ZONE);

        const duration = prefersReducedMotion()
            ? 0
            : settleDurationMs(
                  commit ? width - offset : offset,
                  releaseVelocity,
              );

        if (!commit) {
            setTransform(0, `transform ${duration}ms ease-out`);
            window.setTimeout(clearInlineStyles, duration + 50);

            return;
        }

        haptics.impactLight();
        setTransform(width, `transform ${duration}ms ease-out`);

        window.setTimeout(() => {
            // The exit animation already played; swap the route instantly.
            suppressNextTransition.value = true;
            router.back();
            // Reset after the swap renders so the previous page never shows
            // translated.
            requestAnimationFrame(() => {
                requestAnimationFrame(clearInlineStyles);
            });
        }, duration);
    }

    function getCurrentOffset(el: HTMLElement | null): number {
        if (!el || !el.style.transform) {
            return 0;
        }

        const match = el.style.transform.match(/translateX\(([\d.]+)px\)/);

        return match ? parseFloat(match[1]) : 0;
    }

    onMounted(() => {
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    });

    onUnmounted(() => {
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('touchcancel', onTouchEnd);
    });
}
