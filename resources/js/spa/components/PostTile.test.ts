import { createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import type { PostData } from './PostCard.vue';

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/spa/http/externalApi', () => ({
    externalApi: {
        get: vi.fn(() => Promise.resolve({})),
        post: vi.fn(() => Promise.resolve({})),
        delete: vi.fn(() => Promise.resolve({})),
    },
}));

vi.mock('@/spa/services/postHeroTransition', () => ({
    openPostWithHeroTransition: vi.fn(),
}));

// Capture observer instances so tests can drive visibility by hand; the tile
// must never mount a VideoPlayer for an off-screen video.
class MockIntersectionObserver {
    static instances: MockIntersectionObserver[] = [];

    callback: IntersectionObserverCallback;
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = (): IntersectionObserverEntry[] => [];

    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        MockIntersectionObserver.instances.push(this);
    }
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

const PostTile = (await import('./PostTile.vue')).default;

function makePost(overrides: Partial<PostData> = {}): PostData {
    return {
        id: 'post-1',
        media_url: 'https://cdn.test/full.jpg',
        media_type: 'image',
        thumbnail_url: 'https://cdn.test/thumb.jpg',
        thumbnail_small_url: 'https://cdn.test/thumb-small.jpg',
        media_status: 'ready',
        width: 1200,
        height: 1600,
        caption: null,
        location: null,
        created_at: '2026-01-01T12:00:00Z',
        user: {
            id: 'user-1',
            name: 'Test User',
            username: 'testuser',
            avatar: null,
        },
        is_liked: false,
        likes_count: 0,
        comments_count: 0,
        ...overrides,
    };
}

function mountTile(
    post: PostData,
    resolvePoster?: (p: PostData) => string | null,
) {
    const app = createApp(PostTile, { post, resolvePoster });
    app.use(createPinia());

    const host = document.createElement('div');
    document.body.appendChild(host);
    app.mount(host);

    return {
        host,
        unmount: () => {
            app.unmount();
            host.remove();
        },
    };
}

beforeEach(() => {
    MockIntersectionObserver.instances = [];
    document.body.innerHTML = '';
});

describe('PostTile poster source', () => {
    it('renders image tiles from the medium thumbnail instead of the full rendition', () => {
        const { host, unmount } = mountTile(makePost());

        const img = host.querySelector('img');
        expect(img?.getAttribute('src')).toBe('https://cdn.test/thumb.jpg');

        unmount();
    });

    it('falls back to the full media url when no thumbnail exists', () => {
        const { host, unmount } = mountTile(
            makePost({ thumbnail_url: null, thumbnail_small_url: null }),
        );

        const img = host.querySelector('img');
        expect(img?.getAttribute('src')).toBe('https://cdn.test/full.jpg');

        unmount();
    });

    it('uses the video poster and never the video file for video tiles', () => {
        const { host, unmount } = mountTile(
            makePost({
                media_type: 'video',
                media_url: 'https://cdn.test/stream.m3u8',
                thumbnail_url: 'https://cdn.test/poster.jpg',
            }),
        );

        const img = host.querySelector('img');
        expect(img?.getAttribute('src')).toBe('https://cdn.test/poster.jpg');

        unmount();
    });

    it('prefers the resolvePoster override over API media', () => {
        const { host, unmount } = mountTile(
            makePost(),
            () => 'blob:local-preview',
        );

        const img = host.querySelector('img');
        expect(img?.getAttribute('src')).toBe('blob:local-preview');

        unmount();
    });
});

describe('PostTile rendering containment', () => {
    it('opts the tile root into content-visibility so off-screen tiles skip layout and paint', () => {
        const { host, unmount } = mountTile(makePost());

        const root = host.firstElementChild as HTMLElement;
        expect(root.className).toContain('[content-visibility:auto]');

        unmount();
    });

    it('keeps ready videos on their poster until the tile intersects the viewport', () => {
        const { host, unmount } = mountTile(
            makePost({
                media_type: 'video',
                media_url: 'https://cdn.test/clip.mp4',
                thumbnail_url: 'https://cdn.test/poster.jpg',
            }),
        );

        expect(host.querySelector('video')).toBeNull();
        expect(MockIntersectionObserver.instances).toHaveLength(1);

        unmount();
    });
});
