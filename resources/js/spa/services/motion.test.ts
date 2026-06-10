import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createVelocityTracker,
    prefersReducedMotion,
    rollDirection,
    settleDurationMs,
} from './motion';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('settleDurationMs', () => {
    it('uses the default duration for a static release', () => {
        expect(settleDurationMs(200, 0)).toBe(300);
        expect(settleDurationMs(200, 0.05)).toBe(300);
    });

    it('settles fast after a quick flick', () => {
        // 100px left at 2px/ms → 50ms, clamped up to the minimum.
        expect(settleDurationMs(100, 2)).toBe(150);
    });

    it('never exceeds the maximum duration on slow releases', () => {
        // 600px at 0.2px/ms → 3000ms, clamped down.
        expect(settleDurationMs(600, 0.2)).toBe(350);
    });

    it('scales with remaining distance between the clamps', () => {
        // 200px at 1px/ms → 200ms.
        expect(settleDurationMs(200, 1)).toBe(200);
        // Direction of travel does not matter.
        expect(settleDurationMs(-200, -1)).toBe(200);
    });

    it('uses the minimum duration when already at rest', () => {
        expect(settleDurationMs(0, 3)).toBe(150);
    });
});

describe('createVelocityTracker', () => {
    it('reports velocity from successive samples', () => {
        const now = vi.spyOn(performance, 'now');
        const tracker = createVelocityTracker();

        now.mockReturnValue(1000);
        tracker.start(0);

        now.mockReturnValue(1010);
        tracker.move(20);

        expect(tracker.velocity()).toBe(2);
    });

    it('is zero before any movement', () => {
        const tracker = createVelocityTracker();

        tracker.start(50);

        expect(tracker.velocity()).toBe(0);
    });

    it('tracks direction through the sign', () => {
        const now = vi.spyOn(performance, 'now');
        const tracker = createVelocityTracker();

        now.mockReturnValue(1000);
        tracker.start(100);

        now.mockReturnValue(1020);
        tracker.move(60);

        expect(tracker.velocity()).toBe(-2);
    });
});

describe('rollDirection', () => {
    it('rolls up when the value increases', () => {
        expect(rollDirection(5, 4)).toBe('up');
        expect(rollDirection('10', '9')).toBe('up');
    });

    it('rolls down when the value decreases', () => {
        expect(rollDirection(3, 4)).toBe('down');
    });

    it('defaults to up for equal or non-numeric values', () => {
        expect(rollDirection(4, 4)).toBe('up');
        expect(rollDirection('99+', 99)).toBe('up');
    });
});

describe('prefersReducedMotion', () => {
    it('reflects the media query', () => {
        const matchMedia = vi.fn().mockReturnValue({ matches: true });
        vi.stubGlobal('matchMedia', matchMedia);

        expect(prefersReducedMotion()).toBe(true);
        expect(matchMedia).toHaveBeenCalledWith(
            '(prefers-reduced-motion: reduce)',
        );

        vi.unstubAllGlobals();
    });
});
