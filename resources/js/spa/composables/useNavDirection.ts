import { ref } from 'vue';
import { resolveActiveTab } from '@/spa/composables/useBottomNav';

/**
 * Direction-aware route transitions.
 *
 * iOS runs on in-memory history (no `history.state.position`), so we keep our
 * own navigation stack: revisiting the entry directly under the top is a
 * "back" navigation, everything else is "forward". Combined with the route
 * hierarchy this picks the transition style:
 *
 * - `fade`: lateral moves between bottom-nav tabs (and anything ambiguous)
 * - `push`: descending into content (feed → notifications, circle → post)
 * - `pop`:  returning up the hierarchy or an explicit back navigation
 */
export type TransitionKind = 'fade' | 'push' | 'pop' | 'none';

/** Depth of a path in the route hierarchy ('/' = 0, '/a/b' = 2). */
export function routeDepth(path: string): number {
    if (path === '/') {
        return 0;
    }

    return path.split('/').filter(Boolean).length;
}

/**
 * Pick the transition for a navigation. `wentBack` is the stack's verdict
 * (true when the user returned to the previous entry).
 */
export function transitionKindFor(
    toPath: string,
    fromPath: string,
    wentBack: boolean,
): TransitionKind {
    const toTab = resolveActiveTab(toPath) !== '';
    const fromTab = resolveActiveTab(fromPath) !== '';

    // Tab-to-tab switches are lateral, not hierarchical.
    if (toTab && fromTab) {
        return 'fade';
    }

    if (wentBack) {
        return 'pop';
    }

    if (fromTab && !toTab) {
        return 'push';
    }

    if (!fromTab && toTab) {
        return 'pop';
    }

    const depthDelta = routeDepth(toPath) - routeDepth(fromPath);

    // Equal-depth navigations between stacked views (profile → profile)
    // present new content, so they read as a push.
    return depthDelta < 0 ? 'pop' : 'push';
}

/**
 * Navigation stack tracker. Returns whether each navigation was a "back"
 * (returning to the entry under the current top) and maintains the stack.
 * Factory style so tests can create isolated instances.
 */
export function createNavTracker() {
    const stack: string[] = [];

    return {
        /** Record a completed navigation; true when it was a back-move. */
        record(toPath: string): boolean {
            if (stack.length >= 2 && stack[stack.length - 2] === toPath) {
                stack.pop();

                return true;
            }

            if (stack[stack.length - 1] !== toPath) {
                stack.push(toPath);
            }

            return false;
        },

        /** Whether there is an entry to go back to. */
        canGoBack(): boolean {
            return stack.length > 1;
        },

        /** Path that a back navigation would land on, if any. */
        previousPath(): string | null {
            return stack.length > 1 ? stack[stack.length - 2] : null;
        },
    };
}

// Shared app-wide instance: App.vue records navigations, the edge-swipe back
// gesture consults canGoBack().
export const navTracker = createNavTracker();

// Last navigation's transition kind, updated from App.vue's afterEach hook.
export const lastTransitionKind = ref<TransitionKind>('fade');

// One-shot suppression: the edge-swipe back gesture already animated the page
// off-screen, so the route swap itself must be instant ('none') instead of
// playing the pop transition a second time.
export const suppressNextTransition = ref(false);
