import { createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import type { PostData } from './PostCard.vue';

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn() }),
    RouterLink: defineComponent({
        props: { to: { type: [String, Object], required: true } },
        setup(_, { slots }) {
            return () => h('a', slots.default?.());
        },
    }),
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

// Capture observer instances so tests can drive viewport visibility by hand.
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

    intersect(isIntersecting: boolean): void {
        this.callback(
            [{ isIntersecting } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
        );
    }
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

const PostCard = (await import('./PostCard.vue')).default;

function makePost(overrides: Partial<PostData> = {}): PostData {
    return {
        id: 'post-1',
        media_url: 'https://cdn.test/clip.mp4',
        media_type: 'video',
        thumbnail_url: 'https://cdn.test/poster.jpg',
        thumbnail_small_url: 'https://cdn.test/thumb-small.jpg',
        media_status: 'ready',
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

function mountCard(post: PostData) {
    const app = createApp(PostCard, { post });
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

describe('PostCard video visibility gating', () => {
    it('shows the poster without mounting a player while the card is off-screen', () => {
        const { host, unmount } = mountCard(makePost());

        expect(host.querySelector('video')).toBeNull();

        const poster = host.querySelector(
            'img[src="https://cdn.test/poster.jpg"]',
        );
        expect(poster).not.toBeNull();

        unmount();
    });

    it('mounts the player when the card scrolls into view and unmounts it on the way out', async () => {
        const { host, unmount } = mountCard(makePost());

        const observer = MockIntersectionObserver.instances[0];
        expect(observer).toBeDefined();
        expect(observer.observe).toHaveBeenCalled();

        observer.intersect(true);
        await nextTick();
        expect(host.querySelector('video')).not.toBeNull();

        observer.intersect(false);
        await nextTick();
        expect(host.querySelector('video')).toBeNull();

        unmount();
    });

    it('does not observe image cards', () => {
        const { unmount } = mountCard(
            makePost({
                media_type: 'image',
                media_url: 'https://cdn.test/full.jpg',
            }),
        );

        expect(MockIntersectionObserver.instances).toHaveLength(0);

        unmount();
    });

    it('disconnects the observer when the card unmounts', () => {
        const { unmount } = mountCard(makePost());

        const observer = MockIntersectionObserver.instances[0];
        unmount();

        expect(observer.disconnect).toHaveBeenCalled();
    });
});

describe('PostCard rendering containment', () => {
    it('opts the card root into content-visibility so off-screen cards skip layout and paint', () => {
        const { host, unmount } = mountCard(makePost());

        const article = host.querySelector('article') as HTMLElement;
        expect(article.className).toContain('[content-visibility:auto]');
        expect(article.className).toContain(
            '[contain-intrinsic-size:auto_520px]',
        );

        unmount();
    });

    it('lazy-loads both the blur-up and the display image on image cards', () => {
        const { host, unmount } = mountCard(
            makePost({
                media_type: 'image',
                media_url: 'https://cdn.test/full.jpg',
            }),
        );

        const lazyImages = [
            ...host.querySelectorAll('img[loading="lazy"]'),
        ].map((img) => img.getAttribute('src'));
        expect(lazyImages).toContain('https://cdn.test/thumb-small.jpg');
        expect(lazyImages).toContain('https://cdn.test/full.jpg');

        unmount();
    });
});
