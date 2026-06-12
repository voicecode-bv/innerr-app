import type { RouteLocationNormalizedLoaded } from 'vue-router';

/**
 * The post detail page renders as an overlay on top of the page it was
 * opened from: the background (usually the feed) stays mounted so its
 * scroll position is preserved, while the URL, the back button, and
 * deeplinks keep working because it is still a real route.
 */
export const POST_DETAIL_ROUTE_NAME = 'spa.posts.show';

type RouteNameLike = Pick<RouteLocationNormalizedLoaded, 'name'>;

/** Whether the given route is the post detail overlay. */
export function isPostDetailRoute(route: RouteNameLike): boolean {
    return route.name === POST_DETAIL_ROUTE_NAME;
}

/**
 * Which background location the overlay should remember when it opens.
 *
 * - `undefined` → change nothing: we are not opening an overlay, or we jump
 *   from post to post without disturbing the backdrop underneath.
 * - a `string` → the `fullPath` of the page we open the overlay from.
 * - `null` → direct deeplink without a real previous page; the overlay then
 *   falls back to the feed as backdrop (see the `?? '/'` fallback when
 *   rendering).
 */
export function backgroundPathOnOverlayEnter(
    to: RouteNameLike,
    from: RouteNameLike & Pick<RouteLocationNormalizedLoaded, 'fullPath'>,
): string | null | undefined {
    if (!isPostDetailRoute(to) || isPostDetailRoute(from)) {
        return undefined;
    }

    return from.name ? from.fullPath : null;
}
