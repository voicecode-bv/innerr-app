import { defineStore } from 'pinia';

interface CommentLike {
    id: number;
}

interface PageEntry<T extends CommentLike> {
    comments: T[];
    currentPage: number;
    lastPage: number;
    cachedAt: number;
}

const FRESH_TTL_MS = 60 * 1000;

export const useCommentsCacheStore = defineStore('spa-comments-cache', {
    state: () => ({
        entries: {} as Record<number, PageEntry<CommentLike>>,
    }),
    actions: {
        get<T extends CommentLike>(
            postId: number,
            ttlMs: number = FRESH_TTL_MS,
        ): PageEntry<T> | null {
            const entry = this.entries[postId];
            if (!entry) return null;
            if (Date.now() - entry.cachedAt > ttlMs) return null;
            return entry as PageEntry<T>;
        },
        getStale<T extends CommentLike>(postId: number): PageEntry<T> | null {
            return (this.entries[postId] as PageEntry<T> | undefined) ?? null;
        },
        set<T extends CommentLike>(
            postId: number,
            comments: T[],
            currentPage: number,
            lastPage: number,
        ): void {
            this.entries[postId] = {
                comments,
                currentPage,
                lastPage,
                cachedAt: Date.now(),
            };
        },
        invalidate(postId: number): void {
            delete this.entries[postId];
        },
        clear(): void {
            this.entries = {};
        },
    },
});
