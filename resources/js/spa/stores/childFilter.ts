import { defineStore } from 'pinia';

// Which children the home feed is scoped to. An empty list means "all children"
// (the default). Driven by the ChildTimelineMenu in the feed header; both the
// list and grid feeds read it through useChildFeedQuery, so picking children
// filters the current view in place instead of navigating away.
//
// Persisted to localStorage so the choice survives app restarts, just like the
// feed-sort preference.
const STORAGE_KEY = 'spa.child-filter';

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

export const useChildFilterStore = defineStore('spa-child-filter', {
    state: () => ({
        selectedIds: loadInitial(),
    }),
    actions: {
        setSelected(ids: string[]): void {
            this.selectedIds = [...ids];
            window.localStorage?.setItem(
                STORAGE_KEY,
                JSON.stringify(this.selectedIds),
            );
        },
    },
});
