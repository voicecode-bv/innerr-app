import { defineStore } from 'pinia';

interface CacheEntry<T> {
    post: T;
    cachedAt: number;
}

const FRESH_TTL_MS = 2 * 60 * 1000;

export const usePostCacheStore = defineStore('spa-post-cache', {
    state: () => ({
        // shape: Record<postId, CacheEntry<unknown>>
        // Using `unknown` zodat de page zelf het type van Post bezit zonder
        // hier te hoeven importeren — voorkomt circular deps.
        entries: {} as Record<string, CacheEntry<unknown>>,
    }),
    actions: {
        get<T>(postId: string, ttlMs: number = FRESH_TTL_MS): T | null {
            const entry = this.entries[postId];

            if (!entry) {
                return null;
            }

            if (Date.now() - entry.cachedAt > ttlMs) {
                return null;
            }

            return entry.post as T;
        },
        getStale<T>(postId: string): T | null {
            return (this.entries[postId]?.post as T | undefined) ?? null;
        },
        set<T>(postId: string, post: T): void {
            this.entries[postId] = {
                post: post as unknown,
                cachedAt: Date.now(),
            };
        },
        invalidate(postId: string): void {
            delete this.entries[postId];
        },
        clear(): void {
            this.entries = {};
        },
    },
});
