import { describe, expect, it } from 'vitest';
import type { Circle } from './circles';
import { sortByRecentlyUpdated } from './circles';

function circle(overrides: Partial<Circle> & { id: string }): Circle {
    return { name: overrides.id, photo: null, ...overrides };
}

describe('sortByRecentlyUpdated', () => {
    it('orders the most recently updated circle first', () => {
        const circles = [
            circle({ id: 'old', updated_at: '2026-01-01T10:00:00Z' }),
            circle({ id: 'new', updated_at: '2026-06-01T10:00:00Z' }),
            circle({ id: 'mid', updated_at: '2026-03-01T10:00:00Z' }),
        ];

        expect(sortByRecentlyUpdated(circles).map((c) => c.id)).toEqual([
            'new',
            'mid',
            'old',
        ]);
    });

    it('does not mutate the input array', () => {
        const circles = [
            circle({ id: 'a', updated_at: '2026-01-01T10:00:00Z' }),
            circle({ id: 'b', updated_at: '2026-02-01T10:00:00Z' }),
        ];

        sortByRecentlyUpdated(circles);

        expect(circles.map((c) => c.id)).toEqual(['a', 'b']);
    });

    it('falls back to created_at when updated_at is missing', () => {
        const circles = [
            circle({ id: 'no-update', created_at: '2026-05-01T10:00:00Z' }),
            circle({ id: 'recent', updated_at: '2026-06-01T10:00:00Z' }),
        ];

        expect(sortByRecentlyUpdated(circles).map((c) => c.id)).toEqual([
            'recent',
            'no-update',
        ]);
    });

    it('breaks ties on name so the order is stable', () => {
        const ts = '2026-06-01T10:00:00Z';
        const circles = [
            circle({ id: '3', name: 'Charlie', updated_at: ts }),
            circle({ id: '1', name: 'Alice', updated_at: ts }),
            circle({ id: '2', name: 'Bob', updated_at: ts }),
        ];

        expect(sortByRecentlyUpdated(circles).map((c) => c.name)).toEqual([
            'Alice',
            'Bob',
            'Charlie',
        ]);
    });
});
