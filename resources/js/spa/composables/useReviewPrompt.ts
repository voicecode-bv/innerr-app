import { isNativeRuntime } from '@/spa/composables/usePlatform';
import { externalApi } from '@/spa/http/externalApi';
import { BridgeCall } from '@nativephp/mobile';

// Thresholds above which we ask the user for a review:
// - more than 5 published posts (so starting at 6), or
// - 5 or more likes given, or
// - 5 or more comments posted.
const POSTS_THRESHOLD = 5;
const LIKES_THRESHOLD = 5;
const COMMENTS_THRESHOLD = 5;

// One-time flag in localStorage. Once we have requested the review we never
// ask again and we also stop fetching the counts.
const REQUESTED_KEY = 'spa.review.requested';

interface ProfileCounts {
    posts_count: number;
    // Only present on the user's own profile; missing on an older API.
    likes_count?: number;
    comments_count?: number;
}

function hasRequested(): boolean {
    return window.localStorage?.getItem(REQUESTED_KEY) === '1';
}

async function fetchCounts(username: string): Promise<ProfileCounts> {
    const response = await externalApi.get<{ data: ProfileCounts }>(
        `/profiles/${encodeURIComponent(username)}`,
    );

    return response.data;
}

function meetsThreshold(counts: ProfileCounts): boolean {
    return (
        counts.posts_count > POSTS_THRESHOLD ||
        (counts.likes_count ?? 0) >= LIKES_THRESHOLD ||
        (counts.comments_count ?? 0) >= COMMENTS_THRESHOLD
    );
}

/**
 * Request the native in-app review flow (Google Play / App Store). The OS
 * layer decides for itself whether and how often the dialog actually
 * appears.
 */
async function requestReview(): Promise<void> {
    await BridgeCall('InAppReviews.RequestReview', {});
}

/**
 * Based on the user's actual activity, ask once for an app review as soon
 * as they have published enough posts or liked / commented enough.
 *
 * Call this in the success path of posting, liking, and commenting. The
 * profile call only happens while we haven't asked yet and in the native
 * runtime, so web/desktop and already-prompted users don't make an extra
 * network round trip. Fails silently so it can never break the action.
 */
export async function maybeRequestReview(
    username: string | null | undefined,
): Promise<void> {
    try {
        if (!username || hasRequested() || !isNativeRuntime()) {
            return;
        }

        const counts = await fetchCounts(username);

        if (!meetsThreshold(counts)) {
            return;
        }

        // Mark as requested first so a failed bridge call doesn't try to
        // prompt again on every subsequent action.
        window.localStorage?.setItem(REQUESTED_KEY, '1');
        await requestReview();
    } catch {
        // No native bridge, no network, or no storage: skip silently.
    }
}

export function useReviewPrompt() {
    return {
        maybeRequestReview,
    };
}
