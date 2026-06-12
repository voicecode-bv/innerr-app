import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRelativeTime } from './useRelativeTime';

// With an empty translation bundle, t() falls back to the key with
// placeholders substituted, so assertions read like the English output.

const NOW = new Date('2026-06-11T12:00:00Z');

beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

function ago(seconds: number): string {
    return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

describe('useRelativeTime', () => {
    it('formats each bucket of the ladder', () => {
        const { timeAgo } = useRelativeTime();

        expect(timeAgo(ago(30))).toBe('just now');
        expect(timeAgo(ago(5 * 60))).toBe('5 min ago');
        expect(timeAgo(ago(3 * 3600))).toBe('3 hours ago');
        expect(timeAgo(ago(2 * 86400))).toBe('2 days ago');
        expect(timeAgo(ago(2 * 604800))).toBe('2 weeks ago');
        expect(timeAgo(ago(3 * 2592000))).toBe('3 months ago');
        expect(timeAgo(ago(2 * 31536000))).toBe('2 years ago');
    });

    it('uses singular keys at exactly one unit', () => {
        const { timeAgo } = useRelativeTime();

        expect(timeAgo(ago(86400))).toBe('1 day ago');
        expect(timeAgo(ago(604800))).toBe('1 week ago');
        expect(timeAgo(ago(2592000))).toBe('1 month ago');
        expect(timeAgo(ago(31536000))).toBe('1 year ago');
    });

    it('clamps boundaries to the smaller bucket', () => {
        const { timeAgo } = useRelativeTime();

        expect(timeAgo(ago(59))).toBe('just now');
        expect(timeAgo(ago(3599))).toBe('59 min ago');
        expect(timeAgo(ago(86399))).toBe('23 hours ago');
    });
});
