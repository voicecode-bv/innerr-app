import { describe, expect, it } from 'vitest';
import {
    bottomNavVisibleFor,
    resolveActiveTab,
    resolveMapUrl,
    resolveProfileUrl,
    shouldHideBottomNav,
} from './useBottomNav';

describe('resolveActiveTab', () => {
    it.each([
        ['/', 'home'],
        ['/feed/grid', 'home'],
        ['/map', 'map'],
        ['/circles/5/map', 'map'],
        ['/profiles/bob/map', 'map'],
        ['/circles', 'circles'],
        ['/posts/create', 'add'],
        ['/quotes/create', 'add'],
        ['/profiles/bob', 'profile'],
        // Nested circle pages leave the tab inactive so a tap navigates back.
        ['/circles/5', ''],
        ['/notifications', ''],
        ['/settings', ''],
    ])('maps %s to %s', (path, expected) => {
        expect(resolveActiveTab(path)).toBe(expected);
    });
});

describe('resolveMapUrl', () => {
    it('deep-links to a circle map when inside a circle', () => {
        expect(resolveMapUrl('/circles/12/feed')).toBe('/circles/12/map');
        expect(resolveMapUrl('/circles/12')).toBe('/circles/12/map');
    });

    it('deep-links to a profile map when inside a profile', () => {
        expect(resolveMapUrl('/profiles/alice')).toBe('/profiles/alice/map');
        expect(resolveMapUrl('/profiles/alice/settings')).toBe(
            '/profiles/alice/map',
        );
    });

    it('falls back to the global map', () => {
        expect(resolveMapUrl('/')).toBe('/map');
        expect(resolveMapUrl('/notifications')).toBe('/map');
    });
});

describe('resolveProfileUrl', () => {
    it('points to the current user profile', () => {
        expect(resolveProfileUrl('bob')).toBe('/profiles/bob');
    });

    it('falls back to the feed without a username', () => {
        expect(resolveProfileUrl(null)).toBe('/');
        expect(resolveProfileUrl(undefined)).toBe('/');
    });
});

describe('shouldHideBottomNav', () => {
    it.each([
        ['/onboarding/intro', true],
        ['/onboarding/circles/5/invite', true],
        ['/posts/create', true],
        ['/quotes/create', true],
        ['/', false],
        ['/circles', false],
    ])('returns %s for %s', (path, expected) => {
        expect(shouldHideBottomNav(path)).toBe(expected);
    });
});

describe('bottomNavVisibleFor', () => {
    const onboarded = { onboarded: true };

    it('is hidden without a user', () => {
        expect(bottomNavVisibleFor({ path: '/', meta: {} }, null)).toBe(false);
    });

    it('is hidden for a not-yet-onboarded user', () => {
        expect(
            bottomNavVisibleFor({ path: '/', meta: {} }, { onboarded: false }),
        ).toBe(false);
    });

    it('is hidden on guest and public routes', () => {
        expect(
            bottomNavVisibleFor(
                { path: '/login', meta: { guest: true } },
                onboarded,
            ),
        ).toBe(false);
        expect(
            bottomNavVisibleFor(
                { path: '/invite/x', meta: { public: true } },
                onboarded,
            ),
        ).toBe(false);
    });

    it('is hidden on hideEdgeBar routes and the create/onboarding flows', () => {
        expect(
            bottomNavVisibleFor(
                { path: '/feed/filter', meta: { hideEdgeBar: true } },
                onboarded,
            ),
        ).toBe(false);
        expect(
            bottomNavVisibleFor({ path: '/posts/create', meta: {} }, onboarded),
        ).toBe(false);
        expect(
            bottomNavVisibleFor(
                { path: '/onboarding/intro', meta: {} },
                onboarded,
            ),
        ).toBe(false);
    });

    it('is visible on the main app routes', () => {
        expect(bottomNavVisibleFor({ path: '/', meta: {} }, onboarded)).toBe(
            true,
        );
        expect(
            bottomNavVisibleFor({ path: '/circles', meta: {} }, onboarded),
        ).toBe(true);
        expect(
            bottomNavVisibleFor({ path: '/profiles/bob', meta: {} }, onboarded),
        ).toBe(true);
    });
});
