import { computed, ref } from 'vue';
import { prefersReducedMotion } from '@/spa/services/motion';

/**
 * iOS card-stack effect: while a sheet or full-screen overlay is open, the
 * page underneath scales down slightly behind it. Overlays acquire/release a
 * shared counter so nested overlays (sheet on top of post detail) don't fight
 * over the effect; App.vue applies the actual transform on the route
 * container.
 *
 * Skipped entirely under reduced motion: the scale is decoration, and a
 * snap-scale without animation would just look broken.
 */
const overlayCount = ref(0);

export function acquireBackgroundScale(): void {
    overlayCount.value += 1;
}

export function releaseBackgroundScale(): void {
    overlayCount.value = Math.max(0, overlayCount.value - 1);
}

export const backgroundScaled = computed(
    () => overlayCount.value > 0 && !prefersReducedMotion(),
);

// Whether any overlay is open at all (independent of reduced motion). Used by
// gestures that must not grab touches away from an open sheet.
export const hasOpenOverlay = computed(() => overlayCount.value > 0);

// A full-screen overlay that itself acquired the effect (post detail) scales
// its own root when a second overlay (comments/likes sheet) opens on top.
export const stackedOverlayScaled = computed(
    () => overlayCount.value > 1 && !prefersReducedMotion(),
);
