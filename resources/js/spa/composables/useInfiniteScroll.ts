import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { Ref } from 'vue';

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

interface Options<T> {
    rootMargin?: string;
    immediate?: boolean;
    initialItems?: T[];
    initialLastPage?: number;
}

export function useInfiniteScroll<T>(
    fetcher: (page: number) => Promise<PaginatedResponse<T>>,
    sentinelRef: Ref<HTMLElement | null>,
    options: Options<T> = {},
) {
    // Seed with optional initial items from a cache so the UI shows
    // something immediately; on `softRefresh()` we only swap atomically
    // once the fresh data has arrived.
    const initialItems = options.initialItems ?? [];
    const items = ref<T[]>([...initialItems]) as Ref<T[]>;
    const page = ref(initialItems.length > 0 ? 2 : 1);
    const lastPage = ref(options.initialLastPage ?? 1);
    // With `immediate=true` and no seed data: mark loading=true right away
    // so the very first render frame already shows the skeleton instead of
    // flashing the "no posts" empty state.
    const willAutoLoad =
        options.immediate !== false && initialItems.length === 0;
    const loading = ref(willAutoLoad);
    const error = ref<Error | null>(null);
    const finished = ref(
        initialItems.length > 0 && page.value > (options.initialLastPage ?? 1),
    );

    let observer: IntersectionObserver | null = null;
    const seenIds = new Set<string | number>();

    for (const item of initialItems) {
        const id = (item as { id?: string | number }).id;

        if (id !== undefined) {
            seenIds.add(id);
        }
    }

    async function loadMore(): Promise<void> {
        if (loading.value || finished.value) {
            return;
        }

        loading.value = true;
        error.value = null;

        try {
            const response = await fetcher(page.value);

            for (const item of response.data) {
                const id = (item as { id?: string | number }).id;

                if (id !== undefined) {
                    if (seenIds.has(id)) {
                        continue;
                    }

                    seenIds.add(id);
                }

                items.value.push(item);
            }

            lastPage.value = response.meta.last_page;
            page.value = response.meta.current_page + 1;

            if (page.value > lastPage.value) {
                finished.value = true;
            }
        } catch (e) {
            error.value = e instanceof Error ? e : new Error(String(e));
        } finally {
            loading.value = false;
        }
    }

    async function reset(): Promise<void> {
        items.value = [];
        seenIds.clear();
        page.value = 1;
        lastPage.value = 1;
        finished.value = false;
        await loadMore();
    }

    // Background refresh that fetches page 1 and only swaps items once the
    // response has arrived — avoids an empty flash between "show stale" and
    // "fresh".
    async function softRefresh(): Promise<PaginatedResponse<T> | null> {
        if (loading.value) {
            return null;
        }

        loading.value = true;
        error.value = null;

        try {
            const response = await fetcher(1);

            const fresh: T[] = [];
            const freshSeen = new Set<string | number>();

            for (const item of response.data) {
                const id = (item as { id?: string | number }).id;

                if (id !== undefined) {
                    if (freshSeen.has(id)) {
                        continue;
                    }

                    freshSeen.add(id);
                }

                fresh.push(item);
            }

            items.value = fresh;
            seenIds.clear();

            for (const id of freshSeen) {
                seenIds.add(id);
            }

            lastPage.value = response.meta.last_page;
            page.value = response.meta.current_page + 1;
            finished.value = page.value > lastPage.value;

            return response;
        } catch (e) {
            error.value = e instanceof Error ? e : new Error(String(e));

            return null;
        } finally {
            loading.value = false;
        }
    }

    function attachObserver(target: HTMLElement): void {
        observer?.disconnect();
        observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    loadMore();
                }
            },
            // Prefetch the next page well before the sentinel reaches the
            // viewport (~1.5 screens ahead) so the next batch is usually already
            // in by the time the user scrolls down — the "load more" indicator
            // is then rarely seen. loadMore() guards on `loading`, so this never
            // fires overlapping requests.
            { rootMargin: options.rootMargin ?? '1200px' },
        );
        observer.observe(target);
    }

    onMounted(() => {
        watch(
            sentinelRef,
            (element) => {
                if (element) {
                    attachObserver(element);
                } else {
                    observer?.disconnect();
                    observer = null;
                }
            },
            { immediate: true },
        );

        if (options.immediate !== false) {
            // Loading was set to true up front for the skeleton render;
            // reset it here so the loadMore guard doesn't bail out early.
            loading.value = false;
            loadMore();
        }
    });

    onUnmounted(() => {
        observer?.disconnect();
        observer = null;
    });

    return reactive({
        items,
        page,
        lastPage,
        loading,
        error,
        finished,
        loadMore,
        reset,
        softRefresh,
    });
}
