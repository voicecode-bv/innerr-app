/**
 * Remembers a page's scroll position, keyed by a freely chosen key (usually
 * the route name). The storage lives at module level, so the value survives
 * a component unmount/remount: tap a post and return to the feed via
 * "back", and the page can restore where you left off instead of jumping
 * to the top.
 *
 * Deliberately not a Pinia store: this is pure UI state with no need for
 * reactivity — the value is only written on leave and read on return.
 */
const positions = new Map<string, number>();

export function rememberScroll(key: string, top: number): void {
    positions.set(key, top);
}

export function recallScroll(key: string): number | undefined {
    return positions.get(key);
}

export function forgetScroll(key: string): void {
    positions.delete(key);
}
