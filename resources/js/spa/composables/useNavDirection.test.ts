import { describe, expect, it } from 'vitest';
import {
    createNavTracker,
    routeDepth,
    transitionKindFor,
} from './useNavDirection';

describe('routeDepth', () => {
    it('treats the root as depth zero', () => {
        expect(routeDepth('/')).toBe(0);
    });

    it('counts path segments', () => {
        expect(routeDepth('/notifications')).toBe(1);
        expect(routeDepth('/circles/5')).toBe(2);
        expect(routeDepth('/circles/5/feed')).toBe(3);
    });
});

describe('transitionKindFor', () => {
    it('fades between bottom-nav tabs', () => {
        expect(transitionKindFor('/circles', '/', false)).toBe('fade');
        expect(transitionKindFor('/', '/map', false)).toBe('fade');
        expect(transitionKindFor('/feed/grid', '/circles', false)).toBe('fade');
    });

    it('pushes when descending from a tab into content', () => {
        expect(transitionKindFor('/notifications', '/', false)).toBe('push');
        expect(transitionKindFor('/circles/5', '/circles', false)).toBe('push');
        expect(transitionKindFor('/settings/account', '/', false)).toBe('push');
    });

    it('pops when returning to a tab', () => {
        expect(transitionKindFor('/', '/notifications', false)).toBe('pop');
        expect(transitionKindFor('/circles', '/circles/5', true)).toBe('pop');
    });

    it('pops on an explicit back navigation between stacked views', () => {
        expect(
            transitionKindFor(
                '/circles/5',
                '/circles/5/transfer-ownership',
                true,
            ),
        ).toBe('pop');
    });

    it('pushes equal-depth navigations to new stacked content', () => {
        expect(
            transitionKindFor('/timeline/anna', '/notifications', false),
        ).toBe('push');
    });

    it('pops when moving to a shallower stacked view', () => {
        expect(
            transitionKindFor('/notifications', '/circles/5/feed', false),
        ).toBe('pop');
    });
});

describe('createNavTracker', () => {
    it('detects returning to the previous entry as back', () => {
        const tracker = createNavTracker();

        tracker.record('/');
        tracker.record('/notifications');

        expect(tracker.record('/')).toBe(true);
    });

    it('treats new paths as forward', () => {
        const tracker = createNavTracker();

        tracker.record('/');

        expect(tracker.record('/notifications')).toBe(false);
        expect(tracker.record('/circles/5')).toBe(false);
    });

    it('pops the stack on back so chained backs keep working', () => {
        const tracker = createNavTracker();

        tracker.record('/');
        tracker.record('/circles');
        tracker.record('/circles/5');

        expect(tracker.record('/circles')).toBe(true);
        expect(tracker.record('/')).toBe(true);
        expect(tracker.canGoBack()).toBe(false);
    });

    it('ignores duplicate consecutive entries', () => {
        const tracker = createNavTracker();

        tracker.record('/');
        tracker.record('/');

        expect(tracker.canGoBack()).toBe(false);
    });

    it('exposes the previous path for back navigation', () => {
        const tracker = createNavTracker();

        tracker.record('/');
        tracker.record('/settings/account');

        expect(tracker.previousPath()).toBe('/');
        expect(tracker.canGoBack()).toBe(true);
    });
});
