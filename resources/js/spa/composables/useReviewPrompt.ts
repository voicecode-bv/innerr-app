import { BridgeCall } from '@nativephp/mobile';
import { isNativeRuntime } from '@/spa/composables/usePlatform';
import { externalApi } from '@/spa/http/externalApi';

// Drempels waarboven we de gebruiker om een review vragen:
// - meer dan 5 geplaatste posts (dus vanaf 6), of
// - 5 of meer gegeven likes, of
// - 5 of meer geplaatste comments.
const POSTS_THRESHOLD = 5;
const LIKES_THRESHOLD = 5;
const COMMENTS_THRESHOLD = 5;

// Eenmalige vlag in localStorage. Zodra we de review hebben aangevraagd vragen
// we het nooit meer aan en stoppen we ook met het ophalen van de tellingen.
const REQUESTED_KEY = 'spa.review.requested';

interface ProfileCounts {
    posts_count: number;
    // Alleen aanwezig op het eigen profiel; ontbreekt bij een oudere API.
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
 * Vraag de native in-app review flow aan (Google Play / App Store). De OS-laag
 * bepaalt zelf of en hoe vaak het dialoog daadwerkelijk verschijnt.
 */
async function requestReview(): Promise<void> {
    await BridgeCall('InAppReviews.RequestReview', {});
}

/**
 * Vraag, op basis van de werkelijke activiteit van de gebruiker, eenmalig om een
 * app-review zodra die genoeg posts heeft geplaatst of genoeg heeft geliket /
 * gereageerd.
 *
 * Roep dit aan in het success-pad van posten, liken en reageren. De profielcall
 * gebeurt alleen zolang we nog niet hebben gevraagd én in de native runtime,
 * zodat web/desktop en al-geprompte gebruikers geen extra netwerkronde maken.
 * Faalt stil zodat het de actie nooit kan breken.
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

        // Markeer eerst als aangevraagd zodat een mislukte bridge-call niet bij
        // elke volgende actie opnieuw probeert te promoten.
        window.localStorage?.setItem(REQUESTED_KEY, '1');
        await requestReview();
    } catch {
        // Geen native bridge, geen netwerk of geen storage: stil overslaan.
    }
}

export function useReviewPrompt() {
    return {
        maybeRequestReview,
    };
}
