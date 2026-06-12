import { defineStore } from 'pinia';

interface FeedItem {
    id: string;
}

interface FeedCacheEntry<T extends FeedItem> {
    items: T[];
    lastPage: number;
    cachedAt: number;
}

const STORAGE_KEY = 'spa.feed.cache.v2';
const FRESH_TTL_MS = 30 * 1000;

function readStorage(): Record<string, FeedCacheEntry<FeedItem>> {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);

        return raw
            ? (JSON.parse(raw) as Record<string, FeedCacheEntry<FeedItem>>)
            : {};
    } catch {
        return {};
    }
}

function writeStorage(value: Record<string, FeedCacheEntry<FeedItem>>): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
        // ignore — quota full or private mode
    }
}

export const useFeedCacheStore = defineStore('spa-feed-cache', {
    state: () => ({
        entries: readStorage(),
    }),
    actions: {
        // Stale-while-revalidate: also returns entries older than the TTL so
        // the page can show something immediately. The caller checks
        // `isFresh()` itself to decide whether a background refresh is needed.
        get<T extends FeedItem>(key: string): FeedCacheEntry<T> | null {
            return (this.entries[key] as FeedCacheEntry<T> | undefined) ?? null;
        },
        isFresh(key: string, ttlMs: number = FRESH_TTL_MS): boolean {
            const entry = this.entries[key];

            return !!entry && Date.now() - entry.cachedAt < ttlMs;
        },
        set<T extends FeedItem>(
            key: string,
            items: T[],
            lastPage: number,
        ): void {
            this.entries[key] = {
                items: items as FeedItem[],
                lastPage,
                cachedAt: Date.now(),
            };
            writeStorage(this.entries);
        },
        prepend<T extends FeedItem>(key: string, item: T): void {
            const existing = this.entries[key];
            const items = existing
                ? [item as FeedItem, ...existing.items]
                : [item as FeedItem];
            this.entries[key] = {
                items,
                lastPage: existing?.lastPage ?? 1,
                cachedAt: Date.now(),
            };
            writeStorage(this.entries);
        },
        removeItem(key: string, id: string): void {
            const existing = this.entries[key];

            if (!existing) {
                return;
            }

            this.entries[key] = {
                ...existing,
                items: existing.items.filter((item) => item.id !== id),
            };
            writeStorage(this.entries);
        },
        // Replace an item at its current position with a new item that
        // (usually) has a different id. Use case: an optimistic post has id
        // `optimistic-…`; once the server returns the real id we want to
        // substitute it without visually remounting the PostCard —
        // otherwise the thumbnail flickers during the next softRefresh.
        replaceById<T extends FeedItem>(
            key: string,
            oldId: string,
            replacement: T,
        ): void {
            const existing = this.entries[key];

            if (!existing) {
                return;
            }

            const index = existing.items.findIndex((item) => item.id === oldId);

            if (index === -1) {
                return;
            }

            const items = [...existing.items];
            items[index] = replacement as FeedItem;
            this.entries[key] = { ...existing, items };
            writeStorage(this.entries);
        },
        invalidate(key: string): void {
            delete this.entries[key];
            writeStorage(this.entries);
        },
        clear(): void {
            this.entries = {};
            writeStorage(this.entries);
        },
    },
});
