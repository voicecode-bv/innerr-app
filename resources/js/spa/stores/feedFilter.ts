import { defineStore } from 'pinia';

/**
 * Houdt de selectie van de begeleide feed-filter-flow vast over de losse
 * wizard-stappen (personen, circles, datum) heen. Wordt aan het begin van de
 * flow gereset en uitgelezen door de resultaten-pagina om de query op
 * `GET /feed` op te bouwen.
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
         * Bouwt de query-string voor `GET /feed` op uit de actieve filters.
         * Lege categorieën worden weggelaten, zodat een ongekozen filter de
         * resultaten niet onnodig beperkt.
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
