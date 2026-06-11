<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { haptics } from '@/spa/services/haptics';
import {
    createVelocityTracker,
    prefersReducedMotion,
    settleDurationMs,
} from '@/spa/services/motion';

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const mounted = ref(false);
// Visual open-state driving the class-based slide transition when no gesture is
// in progress. Rendered one frame in `-translate-x-full` before flipping to 0
// so a programmatic open animates in. Mirrors the BottomSheet approach.
const displayOpen = ref(false);
const panelRef = ref<HTMLElement | null>(null);

// Live horizontal offset in px while a gesture (or its settle animation) runs:
// 0 = fully open, -panelWidth = fully closed. null hands control back to the
// class-based transition above.
const dragX = ref<number | null>(null);
const settling = ref(false);

const isDragging = computed(() => dragX.value !== null);

// How far from the left screen edge a touch may start to begin an open gesture.
const EDGE_ZONE = 24;
// Movement (px) before we commit to a horizontal (drawer) vs vertical (scroll) axis.
const AXIS_THRESHOLD = 8;
// Above this horizontal release velocity (px/ms) the flick direction wins from
// the midpoint rule, so a short sharp swipe still opens/closes the drawer.
const FLICK_VELOCITY = 0.5;

const velocityTracker = createVelocityTracker();
// Settle duration scales with release velocity; 300ms for programmatic toggles.
const settleDuration = ref(300);

let scrollLocked = false;
let savedBodyOverflow = '';
let touchId: number | null = null;
let candidate: 'open' | 'close' | null = null;
let startX = 0;
let startY = 0;
let axis: 'h' | 'v' | null = null;
let settleTimer: number | null = null;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function panelWidth(): number {
    const measured = panelRef.value?.offsetWidth ?? 0;

    return measured > 0 ? measured : Math.min(320, window.innerWidth * 0.85);
}

function lockScroll(): void {
    if (scrollLocked) {
        return;
    }

    scrollLocked = true;
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
}

function unlockScroll(): void {
    if (!scrollLocked) {
        return;
    }

    scrollLocked = false;
    document.body.style.overflow = savedBodyOverflow;
}

function close(): void {
    emit('update:open', false);
}

function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && props.open) {
        close();
    }
}

watch(
    () => props.open,
    (val) => {
        if (!isDragging.value) {
            settleDuration.value = prefersReducedMotion() ? 0 : 300;
        }

        if (val) {
            lockScroll();
            document.addEventListener('keydown', handleKeydown);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    displayOpen.value = true;
                });
            });
        } else {
            displayOpen.value = false;
            document.removeEventListener('keydown', handleKeydown);

            // Keep the lock while a gesture is still animating shut; endDrag
            // releases it once settled.
            if (!isDragging.value) {
                unlockScroll();
            }
        }
    },
    { immediate: true },
);

// ── Gestures ──────────────────────────────────────────────────────────────
// Edge-swipe from the left opens the drawer; dragging the panel left closes it.
// Both follow the finger and settle to the nearest state on release.

function activeTouch(event: TouchEvent): Touch | null {
    for (const touch of Array.from(event.touches)) {
        if (touch.identifier === touchId) {
            return touch;
        }
    }

    return null;
}

function onTouchStart(event: TouchEvent): void {
    if (touchId !== null || event.touches.length !== 1) {
        return;
    }

    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    axis = null;
    velocityTracker.start(touch.clientX);

    if (!props.open && touch.clientX <= EDGE_ZONE) {
        candidate = 'open';
        touchId = touch.identifier;

        return;
    }

    if (props.open) {
        const target = event.target as HTMLElement | null;
        const onPanel =
            !!panelRef.value && !!target && panelRef.value.contains(target);
        const onControl = !!target?.closest(
            'button, a, input, textarea, select, [role="button"]',
        );

        if (onPanel && !onControl) {
            candidate = 'close';
            touchId = touch.identifier;
        }
    }
}

function startDrag(opening: boolean): void {
    settling.value = false;

    if (settleTimer !== null) {
        clearTimeout(settleTimer);
        settleTimer = null;
    }

    dragX.value = opening ? -panelWidth() : 0;
    lockScroll();
}

function onTouchMove(event: TouchEvent): void {
    if (candidate === null) {
        return;
    }

    const touch = activeTouch(event);

    if (!touch) {
        return;
    }

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    velocityTracker.move(touch.clientX);

    if (axis === null) {
        if (Math.abs(dx) > AXIS_THRESHOLD || Math.abs(dy) > AXIS_THRESHOLD) {
            axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';

            if (axis === 'h') {
                startDrag(candidate === 'open');
            } else {
                // Vertical intent → let the page scroll, abandon the gesture.
                candidate = null;
                touchId = null;
            }
        }

        return;
    }

    if (dragX.value === null) {
        return;
    }

    // We own the horizontal gesture now; stop the page from scrolling sideways.
    event.preventDefault();

    const width = panelWidth();
    const base = candidate === 'open' ? -width : 0;
    dragX.value = clamp(base + dx, -width, 0);
}

function onTouchEnd(): void {
    if (candidate === null) {
        return;
    }

    const dragging = dragX.value !== null;
    const width = panelWidth();
    const releaseVelocity = velocityTracker.velocity();
    // A decisive flick wins from the midpoint rule (right = open, left = close).
    const settleOpen = dragging
        ? Math.abs(releaseVelocity) > FLICK_VELOCITY
            ? releaseVelocity > 0
            : (dragX.value as number) > -width / 2
        : props.open;

    candidate = null;
    touchId = null;

    if (dragging) {
        endDrag(settleOpen, releaseVelocity);
    }
}

function endDrag(settleOpen: boolean, releaseVelocity = 0): void {
    // Animate to the settled edge, then hand control back to the class system.
    const target = settleOpen ? 0 : -panelWidth();
    const remaining = Math.abs((dragX.value ?? target) - target);

    settleDuration.value = prefersReducedMotion()
        ? 0
        : settleDurationMs(remaining, releaseVelocity);

    settling.value = true;
    dragX.value = target;
    haptics.impactMedium();

    settleTimer = window.setTimeout(() => {
        settling.value = false;
        settleTimer = null;
        displayOpen.value = settleOpen;
        dragX.value = null;

        if (settleOpen) {
            if (!props.open) {
                emit('update:open', true);
            }
        } else if (props.open) {
            emit('update:open', false);
        } else {
            unlockScroll();
        }
    }, settleDuration.value);
}

const overlayProgress = computed(() => {
    if (dragX.value !== null) {
        return clamp(1 + dragX.value / panelWidth(), 0, 1);
    }

    return displayOpen.value ? 1 : 0;
});

const panelStyle = computed(() => {
    if (dragX.value === null) {
        return undefined;
    }

    return {
        transform: `translateX(${dragX.value}px)`,
        // No transition while following the finger; the class transition takes
        // over during the settle animation.
        ...(settling.value ? {} : { transition: 'none' }),
    };
});

onMounted(() => {
    mounted.value = true;
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);

    if (settleTimer !== null) {
        clearTimeout(settleTimer);
    }

    unlockScroll();
});
</script>

<template>
    <teleport v-if="mounted" to="body">
        <div
            :class="[
                'fixed inset-0 z-9999 bg-black/40',
                isDragging && !settling
                    ? ''
                    : 'transition-opacity duration-300',
                overlayProgress > 0
                    ? 'pointer-events-auto'
                    : 'pointer-events-none',
            ]"
            :style="{ opacity: overlayProgress }"
            @click="close"
        />
        <aside
            ref="panelRef"
            :class="[
                'fixed top-0 bottom-0 left-0 z-9999 flex w-80 max-w-[85%] touch-pan-y flex-col bg-sand shadow-2xl transition-transform ease-spring-soft',
                'pt-[var(--inset-top)] pb-[var(--inset-bottom)] pl-[var(--inset-left)]',
                displayOpen ? 'translate-x-0' : '-translate-x-full',
            ]"
            :style="{
                transitionDuration: `${settleDuration}ms`,
                ...panelStyle,
            }"
            role="dialog"
            aria-modal="true"
        >
            <slot />
        </aside>
    </teleport>
</template>
