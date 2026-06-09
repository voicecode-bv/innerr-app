import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';

/**
 * Drives the feed's sticky date bar: it shows the month + year of the timeline
 * at the current scroll position (based on the active sort field) and keeps
 * itself pinned just below the dynamic-height FeedHeader.
 *
 * Shared by the list and grid feeds. The caller wires up `dateBarRef` and
 * `headerBottom`/`currentDateLabel` in its template, and calls `recompute()`
 * after it re-fetches the feed in a new order.
 *
 * @param containerRef the scroll container (AppLayout's `mainRef`)
 * @param itemCount reactive getter for the rendered post count, so the label
 *        refreshes whenever new items mount (initial load, pagination, refresh)
 */
export function useFeedDateBar(
    containerRef: Ref<HTMLElement | null>,
    itemCount: () => number,
) {
    const { locale } = useTranslations();

    const dateBarRef = ref<HTMLElement | null>(null);
    const currentDateLabel = ref('');

    // The fixed FeedHeader's height is dynamic (title row, circles strip,
    // safe-area inset), so we measure its real bottom edge and pin the date bar
    // there rather than hardcoding an offset that breaks when the header grows.
    const headerBottom = ref(0);
    let feedHeaderEl: HTMLElement | null = null;
    let headerResizeObserver: ResizeObserver | null = null;
    let scrollTicking = false;

    function measureHeader(): void {
        if (feedHeaderEl) {
            headerBottom.value = feedHeaderEl.getBoundingClientRect().bottom;
        }
    }

    function formatMonthYear(iso: string | undefined): string {
        if (!iso) {
            return '';
        }

        const date = new Date(iso);

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        const label = date.toLocaleDateString(locale.value, {
            month: 'long',
            year: 'numeric',
        });

        // Dutch month names are lowercase; capitalise so the bar reads as a title.
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    // Tiles may be laid out in masonry columns, so the DOM order is not globally
    // top-to-bottom. We scan every mounted tile and keep the lowest one that has
    // already crossed the bar (the largest `top` still at/above the line) — that
    // is the post currently sitting under the date bar.
    function computeCurrentDate(): void {
        const container = containerRef.value;

        if (!container) {
            return;
        }

        const threshold = dateBarRef.value
            ? dateBarRef.value.getBoundingClientRect().bottom
            : container.getBoundingClientRect().top;

        // Feeds are ordered by capture date, so the bar shows the capture date,
        // mirroring the API's `taken_at ?? created_at` fallback.
        const tileDate = (tile: HTMLElement): string | undefined =>
            tile.dataset.takenAt ?? tile.dataset.createdAt;

        const tiles =
            container.querySelectorAll<HTMLElement>('[data-created-at]');
        let crossedTop = -Infinity;
        let crossedDate: string | undefined;
        let topmostTop = Infinity;
        let topmostDate: string | undefined;

        tiles.forEach((tile) => {
            const top = tile.getBoundingClientRect().top;

            if (top < topmostTop) {
                topmostTop = top;
                topmostDate = tileDate(tile);
            }

            if (top <= threshold + 1 && top > crossedTop) {
                crossedTop = top;
                crossedDate = tileDate(tile);
            }
        });

        // At the very top nothing has crossed yet — fall back to the topmost tile.
        const label = formatMonthYear(crossedDate ?? topmostDate);

        if (label) {
            currentDateLabel.value = label;
        }
    }

    function onFeedScroll(): void {
        if (scrollTicking) {
            return;
        }

        scrollTicking = true;
        requestAnimationFrame(() => {
            computeCurrentDate();
            scrollTicking = false;
        });
    }

    watch(
        containerRef,
        (el, previous) => {
            previous?.removeEventListener('scroll', onFeedScroll);
            el?.addEventListener('scroll', onFeedScroll, { passive: true });

            if (el) {
                requestAnimationFrame(computeCurrentDate);
            }
        },
        { immediate: true },
    );

    // Recompute once new items render (initial load, pagination, refresh).
    watch(itemCount, () => requestAnimationFrame(computeCurrentDate));

    onMounted(() => {
        feedHeaderEl =
            document.querySelector<HTMLElement>('[data-feed-header]');

        if (!feedHeaderEl) {
            return;
        }

        measureHeader();

        if (typeof ResizeObserver !== 'undefined') {
            headerResizeObserver = new ResizeObserver(() => {
                measureHeader();
                computeCurrentDate();
            });
            headerResizeObserver.observe(feedHeaderEl);
        }
    });

    onUnmounted(() => {
        containerRef.value?.removeEventListener('scroll', onFeedScroll);
        headerResizeObserver?.disconnect();
        headerResizeObserver = null;
    });

    return {
        dateBarRef,
        currentDateLabel,
        headerBottom,
        recompute: (): number => requestAnimationFrame(computeCurrentDate),
    };
}
