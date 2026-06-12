import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './withTimeout';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('withTimeout', () => {
    it('passes a resolved value through and clears the timer', async () => {
        await expect(
            withTimeout(Promise.resolve('value'), 1000, () => new Error('x')),
        ).resolves.toBe('value');

        expect(vi.getTimerCount()).toBe(0);
    });

    it('passes the original rejection through', async () => {
        const original = new Error('boom');

        await expect(
            withTimeout(Promise.reject(original), 1000, () => new Error('x')),
        ).rejects.toBe(original);
    });

    it('rejects with the constructed error when the promise never settles', async () => {
        const hung = new Promise<never>(() => {});
        const promise = withTimeout(hung, 1500, () => new Error('timed out'));
        const expectation = expect(promise).rejects.toThrow('timed out');

        await vi.advanceTimersByTimeAsync(1500);
        await expectation;
    });

    it('does not time out a promise that settles just before the deadline', async () => {
        let resolve!: (value: string) => void;
        const slow = new Promise<string>((r) => {
            resolve = r;
        });

        const promise = withTimeout(slow, 1500, () => new Error('timed out'));

        await vi.advanceTimersByTimeAsync(1499);
        resolve('made it');

        await expect(promise).resolves.toBe('made it');
    });
});
