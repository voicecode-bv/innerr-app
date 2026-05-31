import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { computed } from 'vue';
import { toValue } from 'vue';

interface MasonryItem {
    id: string;
    width?: number | null;
    height?: number | null;
}

interface Options {
    /**
     * Aspect ratio (height / width) used when an item has no known dimensions,
     * e.g. legacy posts not yet backfilled. 1 renders a square tile.
     */
    fallbackRatio?: number;
    /**
     * Extra estimated height — relative to the column width — added to every
     * tile for its caption/footer area. Only the relative magnitude matters:
     * it nudges the balancer so a tall media item with no footer is not always
     * preferred over a short one with a long caption.
     */
    footerWeight?: number;
}

/**
 * Distribute feed items across N columns for a masonry layout, in pure JS.
 *
 * Each item is greedily placed into the currently-shortest column based on its
 * estimated relative height (media aspect ratio + a fixed footer weight). This
 * is the classic balanced-column algorithm: it preserves a left-to-right,
 * roughly-chronological reading order and — crucially for WKWebView — needs no
 * DOM measuring, ResizeObserver, or absolute positioning, so it recomputes
 * cheaply as infinite scroll appends items.
 *
 * Dimensions come from the API (`width`/`height`), so tiles reserve their final
 * height before the image loads and the grid does not reflow mid-scroll.
 */
export function useMasonry<T extends MasonryItem>(
    items: MaybeRefOrGetter<readonly T[]>,
    columnCount: MaybeRefOrGetter<number>,
    options: Options = {},
): { columns: ComputedRef<T[][]> } {
    const fallbackRatio = options.fallbackRatio ?? 1;
    const footerWeight = options.footerWeight ?? 0.45;

    const columns = computed<T[][]>(() => {
        const count = Math.max(1, Math.floor(toValue(columnCount)));
        const buckets: T[][] = Array.from({ length: count }, () => []);
        const heights = new Array<number>(count).fill(0);

        for (const item of toValue(items)) {
            const ratio =
                item.width && item.height
                    ? item.height / item.width
                    : fallbackRatio;
            const estimatedHeight = ratio + footerWeight;

            let shortest = 0;

            for (let i = 1; i < count; i += 1) {
                if (heights[i] < heights[shortest]) {
                    shortest = i;
                }
            }

            buckets[shortest].push(item);
            heights[shortest] += estimatedHeight;
        }

        return buckets;
    });

    return { columns };
}
