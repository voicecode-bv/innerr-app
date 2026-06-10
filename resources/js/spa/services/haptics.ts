import { isNativeRuntime } from '@/spa/composables/usePlatform';
import { Haptics } from '@innerr/haptics';

/**
 * App-level haptics wrapper. Haptic feedback is decoration: it must never
 * throw, never block, and never matter when it does not fire (web build,
 * simulator, vibrator disabled). Every helper is therefore a synchronous
 * fire-and-forget that swallows bridge errors.
 *
 * Style guide for which helper to use where:
 * - impactLight: gesture thresholds being armed (pull-to-refresh, sheet
 *   crossing its dismiss point) and other ambient ticks.
 * - impactMedium: a committed action with physical weight (like, drawer
 *   snapping open/closed, sheet dismissed).
 * - selection: moving between options (bottom tabs, segmented controls).
 * - notifySuccess / notifyError: outcome of something the user waited on
 *   (post published, upload failed).
 */
function fire(call: () => Promise<void>): void {
    if (!isNativeRuntime()) {
        return;
    }

    try {
        void call().catch(() => {
            /* bridge unavailable: haptics silently skipped */
        });
    } catch {
        /* synchronous bridge failure: equally non-fatal */
    }
}

export const haptics = {
    impactLight(): void {
        fire(() => Haptics.impact('light'));
    },

    impactMedium(): void {
        fire(() => Haptics.impact('medium'));
    },

    impactHeavy(): void {
        fire(() => Haptics.impact('heavy'));
    },

    selection(): void {
        fire(() => Haptics.selection());
    },

    notifySuccess(): void {
        fire(() => Haptics.notification('success'));
    },

    notifyWarning(): void {
        fire(() => Haptics.notification('warning'));
    },

    notifyError(): void {
        fire(() => Haptics.notification('error'));
    },
};
