import { defineStore } from 'pinia';

/**
 * What the current selection is for. The intent decides which posts are
 * selectable (circle assignment needs own posts, printing needs ready photos)
 * and which action bar the masonry shows.
 */
export type SelectionIntent = 'circle' | 'print';

/**
 * Drives the "select photos" flows on the masonry surfaces (home grid, own
 * profile): adding photos to a circle and ordering printed products. State is
 * global but short-lived: pages call `disable()` on unmount so a selection
 * never leaks across navigation.
 */
export const useFeedSelectionStore = defineStore('spa-feed-selection', {
    state: () => ({
        active: false,
        intent: 'circle' as SelectionIntent,
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
        enable(intent: SelectionIntent = 'circle'): void {
            this.active = true;
            this.intent = intent;
        },
        disable(): void {
            this.active = false;
            this.intent = 'circle';
            this.selectedIds = new Set();
        },
        toggleActive(intent: SelectionIntent = 'circle'): void {
            if (this.active) {
                this.disable();
            } else {
                this.enable(intent);
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
