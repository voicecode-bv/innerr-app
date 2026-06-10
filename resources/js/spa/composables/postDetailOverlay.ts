import type { RouteLocationNormalizedLoaded } from 'vue-router';

/**
 * De post-detailpagina rendert als een overlay bovenop de pagina waarvandaan
 * hij geopend werd: de achtergrond (meestal de feed) blijft gemount zodat zijn
 * scroll-positie behouden blijft, terwijl de URL, de back-knop en deeplinks
 * gewoon blijven werken omdat het nog steeds een echte route is.
 */
export const POST_DETAIL_ROUTE_NAME = 'spa.posts.show';

type RouteNameLike = Pick<RouteLocationNormalizedLoaded, 'name'>;

/** Of de gegeven route de post-detail-overlay is. */
export function isPostDetailRoute(route: RouteNameLike): boolean {
    return route.name === POST_DETAIL_ROUTE_NAME;
}

/**
 * Welke achtergrond-locatie de overlay moet onthouden wanneer hij opent.
 *
 * - `undefined` → niets wijzigen: we openen geen overlay, of we springen van
 *   post naar post zonder de backdrop eronder te verstoren.
 * - een `string` → het `fullPath` van de pagina waarvandaan we de overlay openen.
 * - `null` → directe deeplink zonder echte vorige pagina; de overlay valt dan
 *   terug op de feed als backdrop (zie de `?? '/'`-fallback bij het renderen).
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
