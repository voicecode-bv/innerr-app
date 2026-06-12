import { defineStore } from 'pinia';

/**
 * Holds the selection of the guided feed-filter flow across the individual
 * wizard steps (persons, circles, date). Reset at the start of the flow and
 * read by the results page to build the query for `GET /feed`.
 */
export const useFeedFilterStore = defineStore('spa-feed-filter', {
    state: () => ({
        selectedPersonIds: [] as string[],
        selectedCircleIds: [] as string[],
        dateFrom: null as string | null,
        dateTo: null as string | null,
    }),
    getters: {
        hasActiveFilters(state): boolean {
            return (
                state.selectedPersonIds.length > 0 ||
                state.selectedCircleIds.length > 0 ||
                state.dateFrom !== null ||
                state.dateTo !== null
            );
        },
    },
    actions: {
        reset(): void {
            this.selectedPersonIds = [];
            this.selectedCircleIds = [];
            this.dateFrom = null;
            this.dateTo = null;
        },
        /**
         * Builds the query string for `GET /feed` from the active filters.
         * Empty categories are omitted, so an unselected filter does not
         * needlessly restrict the results.
         */
        buildQuery(page: number): string {
            const params = new URLSearchParams();
            params.set('page', String(page));

            for (const id of this.selectedPersonIds) {
                params.append('person_ids[]', id);
            }

            for (const id of this.selectedCircleIds) {
                params.append('circle_ids[]', id);
            }

            if (this.dateFrom) {
                params.set('date_from', this.dateFrom);
            }

            if (this.dateTo) {
                params.set('date_to', this.dateTo);
            }

            return params.toString();
        },
    },
});
