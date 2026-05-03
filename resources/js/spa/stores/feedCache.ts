import { defineStore } from 'pinia';

interface FeedItem {
    id: number;
}

interface FeedCacheEntry<T extends FeedItem> {
    items: T[];
    lastPage: number;
    cachedAt: number;
}

const STORAGE_KEY = 'spa.feed.cache';
const FRESH_TTL_MS = 30 * 1000;

function readStorage(): Record<string, FeedCacheEntry<FeedItem>> {
    if (typeof window === 'undefined') return {};
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
    if (typeof window === 'undefined') return;
    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
        // negeren — quotum vol of private mode
    }
}

export const useFeedCacheStore = defineStore('spa-feed-cache', {
    state: () => ({
        entries: readStorage(),
    }),
    actions: {
        // Stale-while-revalidate: retourneert ook entries ouder dan TTL zodat de
        // page meteen iets kan tonen. Caller checkt zelf `isFresh()` om te
        // bepalen of een background refresh nodig is.
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
        removeItem(key: string, id: number): void {
            const existing = this.entries[key];
            if (!existing) return;
            this.entries[key] = {
                ...existing,
                items: existing.items.filter((item) => item.id !== id),
            };
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
