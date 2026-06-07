import { defineStore } from 'pinia';

/**
 * Drives the "select photos and add them to a circle" flow on the masonry
 * surfaces (home grid, own profile). State is global but short-lived: pages
 * call `disable()` on unmount so a selection never leaks across navigation.
 */
export const useFeedSelectionStore = defineStore('spa-feed-selection', {
    state: () => ({
        active: false,
        selectedIds: new Set<string>(),
    }),
    getters: {
        count: (state): number => state.selectedIds.size,
        isSelected:
            (state) =>
            (id: string): boolean =>
                state.selectedIds.has(id),
    },
    actions: {
        enable(): void {
            this.active = true;
        },
        disable(): void {
            this.active = false;
            this.selectedIds = new Set();
        },
        toggleActive(): void {
            if (this.active) {
                this.disable();
            } else {
                this.enable();
            }
        },
        toggle(id: string): void {
            const next = new Set(this.selectedIds);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            this.selectedIds = next;
        },
        clear(): void {
            this.selectedIds = new Set();
        },
    },
});
