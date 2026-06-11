import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

// Which children the home feed is scoped to. An empty list means "all children"
// (the default). Driven by the ChildTimelineMenu in the feed header; both the
// list and grid feeds read it through useChildFeedQuery, so picking children
// filters the current view in place instead of navigating away.
//
// The server (`GET/PUT /child-filter`, stored per user) is the source of
// truth, so the choice follows the account across devices and reinstalls.
// localStorage acts as a warm cache for an instant first render; `ensureLoaded`
// reconciles it with the server, and `setSelected` applies optimistically
// before persisting.
const STORAGE_KEY = 'spa.child-filter';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function loadInitial(): string[] {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const stored = window.localStorage?.getItem(STORAGE_KEY);
        const parsed: unknown = stored ? JSON.parse(stored) : null;

        return Array.isArray(parsed)
            ? parsed.filter((id): id is string => typeof id === 'string')
            : [];
    } catch {
        return [];
    }
}

function writeWarmCache(ids: string[]): void {
    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // Warm cache only; the server keeps the real value.
    }
}

export const useChildFilterStore = defineStore('spa-child-filter', {
    state: () => ({
        selectedIds: loadInitial(),
        loadedAt: 0,
        loading: null as Promise<void> | null,
    }),
    actions: {
        async ensureLoaded(maxAgeMs: number = DEFAULT_TTL_MS): Promise<void> {
            if (this.loadedAt && Date.now() - this.loadedAt < maxAgeMs) {
                return;
            }

            return this.refresh();
        },
        async refresh(): Promise<void> {
            if (this.loading) {
                return this.loading;
            }

            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{ data: string[] }>(
                        '/child-filter',
                    );

                    // Only swap the array when the contents actually changed:
                    // the feeds watch it by reference, and a fresh-but-equal
                    // array would trigger a needless feed reset.
                    const changed =
                        resp.data.length !== this.selectedIds.length ||
                        resp.data.some((id, i) => id !== this.selectedIds[i]);

                    if (changed) {
                        this.selectedIds = resp.data;
                        writeWarmCache(this.selectedIds);
                    }

                    this.loadedAt = Date.now();
                } catch {
                    // Offline or an older API without the endpoint: keep the
                    // warm-cache value and retry on the next ensureLoaded.
                } finally {
                    this.loading = null;
                }
            })();

            return this.loading;
        },
        setSelected(ids: string[]): void {
            this.selectedIds = [...ids];
            this.loadedAt = Date.now();
            writeWarmCache(this.selectedIds);

            // Optimistic: the UI already switched; persistence is best-effort
            // and the next refresh reconciles with whatever the server kept.
            externalApi
                .put('/child-filter', { person_ids: this.selectedIds })
                .catch(() => {});
        },
        invalidate(): void {
            this.loadedAt = 0;
        },
    },
});
