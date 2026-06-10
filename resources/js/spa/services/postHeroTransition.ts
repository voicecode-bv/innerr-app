import { nextTick, ref } from 'vue';
import { prefersReducedMotion } from '@/spa/services/motion';

/**
 * Shared-element transition between a feed card's media and the post detail
 * hero, via the same-document View Transitions API (WKWebView iOS 18+,
 * Chromium WebView 111+). Where unsupported (or under reduced motion) the
 * caller's navigation runs as-is and the regular slide-up overlay plays.
 *
 * Mechanics: feed media carries `data-post-media="<id>"`; the detail hero
 * carries a permanent `view-transition-name: post-hero`. Around a transition
 * we temporarily give the feed element the same name on the side where it is
 * the morph source/target, taking care that old and new snapshots each
 * contain the name exactly once (duplicates make the browser skip the
 * transition).
 */

export const HERO_NAME = 'post-hero';

// While a hero morph drives the open/close, App.vue must not also play the
// slide-up/down overlay transition.
export const overlayTransitionSuppressed = ref(false);

function supportsViewTransitions(): boolean {
    return (
        typeof document !== 'undefined' &&
        typeof document.startViewTransition === 'function' &&
        !prefersReducedMotion()
    );
}

function feedMediaElement(postId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(
        `[data-post-media="${CSS.escape(postId)}"]`,
    );
}

function tagFeedMedia(postId: string, tagged: boolean): void {
    const el = feedMediaElement(postId);

    if (el) {
        el.style.viewTransitionName = tagged ? HERO_NAME : '';
    }
}

async function runHeroTransition(
    postId: string,
    update: () => Promise<void>,
): Promise<void> {
    overlayTransitionSuppressed.value = true;

    try {
        const transition = document.startViewTransition(update);

        await transition.finished;
    } catch {
        // Skipped transition (duplicate names, timeout): navigation already
        // happened inside `update`, only the morph is lost.
    } finally {
        tagFeedMedia(postId, false);
        overlayTransitionSuppressed.value = false;
    }
}

/**
 * Open the post detail with a media morph. `navigate` must resolve when the
 * route change has completed (router.push does).
 */
export async function openPostWithHeroTransition(
    postId: string,
    navigate: () => Promise<unknown>,
): Promise<void> {
    if (!supportsViewTransitions() || !feedMediaElement(postId)) {
        await navigate();

        return;
    }

    // Old snapshot: the feed card is the named element.
    tagFeedMedia(postId, true);

    await runHeroTransition(postId, async () => {
        await navigate();
        await nextTick();
        // New snapshot: only the detail hero may carry the name.
        tagFeedMedia(postId, false);
    });
}

/**
 * Close the post detail with the reverse morph. `navigate` must resolve when
 * the route change has completed (wrap router.back() in an afterEach promise).
 */
export async function closePostWithHeroTransition(
    postId: string | null,
    navigate: () => Promise<unknown>,
): Promise<void> {
    if (!postId || !supportsViewTransitions() || !feedMediaElement(postId)) {
        await navigate();

        return;
    }

    await runHeroTransition(postId, async () => {
        await navigate();
        await nextTick();
        // New snapshot: the overlay is gone, the feed card is the target.
        tagFeedMedia(postId, true);
    });
}
