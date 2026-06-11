import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { usePullToRefresh } from './usePullToRefresh';

function touchEvent(type: string, clientY: number): Event {
    const event = new Event(type);
    Object.assign(event, { touches: [{ clientY }] });

    return event;
}

function flushMicrotasks(): Promise<void> {
    return new Promise((resolve) => {
        queueMicrotask(() => queueMicrotask(resolve));
    });
}

describe('usePullToRefresh', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        Object.defineProperty(container, 'scrollTop', {
            value: 0,
            writable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('refreshes after a pull past the threshold and settles', async () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { pullDistance, isRefreshing } = usePullToRefresh({
            onRefresh,
            containerRef: ref(container),
        });

        container.dispatchEvent(touchEvent('touchstart', 0));
        container.dispatchEvent(touchEvent('touchmove', 100));

        expect(pullDistance.value).toBe(100);

        container.dispatchEvent(touchEvent('touchend', 100));
        await flushMicrotasks();

        expect(onRefresh).toHaveBeenCalledOnce();
        expect(isRefreshing.value).toBe(false);
        expect(pullDistance.value).toBe(0);
    });

    it('resets when iOS cancels the gesture instead of ending it', () => {
        const onRefresh = vi.fn().mockResolvedValue(undefined);
        const { pullDistance } = usePullToRefresh({
            onRefresh,
            containerRef: ref(container),
        });

        container.dispatchEvent(touchEvent('touchstart', 0));
        container.dispatchEvent(touchEvent('touchmove', 100));

        expect(pullDistance.value).toBe(100);

        container.dispatchEvent(new Event('touchcancel'));

        expect(pullDistance.value).toBe(0);
        expect(onRefresh).not.toHaveBeenCalled();
    });

    it('releases the indicator when a refresh hangs past the timeout', async () => {
        vi.useFakeTimers();

        const onRefresh = vi.fn().mockReturnValue(new Promise<void>(() => {}));
        const { pullDistance, isRefreshing } = usePullToRefresh({
            onRefresh,
            containerRef: ref(container),
        });

        container.dispatchEvent(touchEvent('touchstart', 0));
        container.dispatchEvent(touchEvent('touchmove', 100));
        container.dispatchEvent(touchEvent('touchend', 100));
        await vi.advanceTimersByTimeAsync(0);

        expect(isRefreshing.value).toBe(true);

        await vi.advanceTimersByTimeAsync(10_000);

        expect(isRefreshing.value).toBe(false);
        expect(pullDistance.value).toBe(0);
    });

    it('settles even when the refresh rejects', async () => {
        const onRefresh = vi.fn().mockRejectedValue(new Error('offline'));
        const { pullDistance, isRefreshing } = usePullToRefresh({
            onRefresh,
            containerRef: ref(container),
        });

        container.dispatchEvent(touchEvent('touchstart', 0));
        container.dispatchEvent(touchEvent('touchmove', 100));
        container.dispatchEvent(touchEvent('touchend', 100));
        await flushMicrotasks();

        expect(isRefreshing.value).toBe(false);
        expect(pullDistance.value).toBe(0);
    });
});
