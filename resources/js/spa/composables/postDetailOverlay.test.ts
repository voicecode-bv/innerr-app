import { describe, expect, it } from 'vitest';
import {
    backgroundPathOnOverlayEnter,
    isPostDetailRoute,
} from './postDetailOverlay';

describe('isPostDetailRoute', () => {
    it('is true only for the post detail route', () => {
        expect(isPostDetailRoute({ name: 'spa.posts.show' })).toBe(true);
        expect(isPostDetailRoute({ name: 'spa.home' })).toBe(false);
        expect(isPostDetailRoute({ name: undefined })).toBe(false);
    });
});

describe('backgroundPathOnOverlayEnter', () => {
    it('remembers the page we opened the overlay from', () => {
        expect(
            backgroundPathOnOverlayEnter(
                { name: 'spa.posts.show' },
                { name: 'spa.home', fullPath: '/' },
            ),
        ).toBe('/');

        expect(
            backgroundPathOnOverlayEnter(
                { name: 'spa.posts.show' },
                { name: 'spa.profile', fullPath: '/profiles/bob?tab=posts' },
            ),
        ).toBe('/profiles/bob?tab=posts');
    });

    it('returns null on a cold deeplink so the overlay falls back to the feed', () => {
        // The initial navigation has no named `from` location.
        expect(
            backgroundPathOnOverlayEnter(
                { name: 'spa.posts.show' },
                { name: undefined, fullPath: '/posts/abc-123' },
            ),
        ).toBeNull();
    });

    it('leaves the backdrop untouched when jumping from post to post', () => {
        expect(
            backgroundPathOnOverlayEnter(
                { name: 'spa.posts.show' },
                { name: 'spa.posts.show', fullPath: '/posts/abc-123' },
            ),
        ).toBeUndefined();
    });

    it('does nothing when the target is not the overlay', () => {
        expect(
            backgroundPathOnOverlayEnter(
                { name: 'spa.home' },
                { name: 'spa.profile', fullPath: '/profiles/bob' },
            ),
        ).toBeUndefined();
    });
});
