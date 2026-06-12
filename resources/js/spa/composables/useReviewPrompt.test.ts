import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maybeRequestReview } from './useReviewPrompt';

const bridgeCall = vi.fn();
const apiGet = vi.fn();

vi.mock('@nativephp/mobile', () => ({
    BridgeCall: (method: string, params: object) => {
        bridgeCall(method, params);

        return Promise.resolve(null);
    },
}));

vi.mock('@/spa/http/externalApi', () => ({
    ApiError: class {},
    externalApi: {
        get: (path: string) => apiGet(path),
    },
}));

function setUrl(url: string): void {
    (
        window as unknown as { happyDOM: { setURL(u: string): void } }
    ).happyDOM.setURL(url);
}

function mockCounts(counts: {
    posts_count: number;
    likes_count?: number;
    comments_count?: number;
}): void {
    apiGet.mockResolvedValue({ data: counts });
}

beforeEach(() => {
    window.localStorage.clear();
    bridgeCall.mockReset();
    apiGet.mockReset();
    // Native runtime so the bridge call is attempted at all.
    setUrl('http://127.0.0.1/feed');
});

describe('maybeRequestReview', () => {
    it('does not request below every threshold', async () => {
        mockCounts({ posts_count: 5, likes_count: 4, comments_count: 4 });

        await maybeRequestReview('me');

        expect(bridgeCall).not.toHaveBeenCalled();
    });

    it('requests when more than 5 posts', async () => {
        mockCounts({ posts_count: 6, likes_count: 0, comments_count: 0 });

        await maybeRequestReview('me');

        expect(bridgeCall).toHaveBeenCalledWith(
            'InAppReviews.RequestReview',
            {},
        );
    });

    it('requests when likes reach 5', async () => {
        mockCounts({ posts_count: 0, likes_count: 5, comments_count: 0 });

        await maybeRequestReview('me');

        expect(bridgeCall).toHaveBeenCalledTimes(1);
    });

    it('requests when comments reach 5', async () => {
        mockCounts({ posts_count: 0, likes_count: 0, comments_count: 5 });

        await maybeRequestReview('me');

        expect(bridgeCall).toHaveBeenCalledTimes(1);
    });

    it('requests only once and stops fetching afterwards', async () => {
        mockCounts({ posts_count: 6 });

        await maybeRequestReview('me');
        await maybeRequestReview('me');

        expect(bridgeCall).toHaveBeenCalledTimes(1);
        expect(apiGet).toHaveBeenCalledTimes(1);
    });

    it('tolerates a legacy API without activity counts', async () => {
        mockCounts({ posts_count: 3 });

        await maybeRequestReview('me');

        expect(bridgeCall).not.toHaveBeenCalled();
    });

    it('never fetches or requests on web/desktop', async () => {
        setUrl('https://innerr-app.test/feed');
        mockCounts({ posts_count: 99, likes_count: 99 });

        await maybeRequestReview('me');

        expect(apiGet).not.toHaveBeenCalled();
        expect(bridgeCall).not.toHaveBeenCalled();
    });

    it('does nothing without a username', async () => {
        await maybeRequestReview(null);

        expect(apiGet).not.toHaveBeenCalled();
    });
});
