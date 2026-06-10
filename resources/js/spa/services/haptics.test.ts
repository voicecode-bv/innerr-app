import { beforeEach, describe, expect, it, vi } from 'vitest';

const impact = vi.fn();
const notification = vi.fn();
const selection = vi.fn();
const isNativeRuntime = vi.fn();

vi.mock('@innerr/haptics', () => ({
    Haptics: {
        impact: (...args: unknown[]) => impact(...args),
        notification: (...args: unknown[]) => notification(...args),
        selection: (...args: unknown[]) => selection(...args),
    },
}));

vi.mock('@/spa/composables/usePlatform', () => ({
    isNativeRuntime: () => isNativeRuntime(),
}));

const { haptics } = await import('./haptics');

beforeEach(() => {
    impact.mockReset().mockResolvedValue(undefined);
    notification.mockReset().mockResolvedValue(undefined);
    selection.mockReset().mockResolvedValue(undefined);
    isNativeRuntime.mockReset().mockReturnValue(true);
});

describe('haptics', () => {
    it('maps the impact helpers onto bridge impact styles', () => {
        haptics.impactLight();
        haptics.impactMedium();
        haptics.impactHeavy();

        expect(impact).toHaveBeenNthCalledWith(1, 'light');
        expect(impact).toHaveBeenNthCalledWith(2, 'medium');
        expect(impact).toHaveBeenNthCalledWith(3, 'heavy');
    });

    it('maps the notification helpers onto bridge notification types', () => {
        haptics.notifySuccess();
        haptics.notifyWarning();
        haptics.notifyError();

        expect(notification).toHaveBeenNthCalledWith(1, 'success');
        expect(notification).toHaveBeenNthCalledWith(2, 'warning');
        expect(notification).toHaveBeenNthCalledWith(3, 'error');
    });

    it('plays the selection tick', () => {
        haptics.selection();

        expect(selection).toHaveBeenCalledTimes(1);
    });

    it('does nothing outside the native runtime', () => {
        isNativeRuntime.mockReturnValue(false);

        haptics.impactLight();
        haptics.selection();
        haptics.notifySuccess();

        expect(impact).not.toHaveBeenCalled();
        expect(selection).not.toHaveBeenCalled();
        expect(notification).not.toHaveBeenCalled();
    });

    it('swallows bridge rejections instead of surfacing unhandled errors', async () => {
        impact.mockRejectedValue(new Error('no bridge'));

        expect(() => haptics.impactMedium()).not.toThrow();

        // Give the rejected promise a tick to settle; an unhandled rejection
        // would fail the test run.
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
});
