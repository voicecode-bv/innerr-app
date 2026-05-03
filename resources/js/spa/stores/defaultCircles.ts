import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const useDefaultCirclesStore = defineStore('spa-default-circles', {
    state: () => ({
        ids: null as number[] | null,
        loadedAt: 0,
        loading: null as Promise<number[]> | null,
    }),
    actions: {
        async ensureLoaded(
            maxAgeMs: number = DEFAULT_TTL_MS,
        ): Promise<number[]> {
            if (this.ids && Date.now() - this.loadedAt < maxAgeMs) {
                return this.ids;
            }
            return this.refresh();
        },
        async refresh(): Promise<number[]> {
            if (this.loading) return this.loading;
            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{
                        data: Array<number | { id: number }>;
                    }>('/default-circles');
                    // Externe API kan IDs als nummers OF als objecten met `id` retourneren —
                    // normaliseer naar nummers.
                    this.ids = (resp.data ?? [])
                        .map((entry) =>
                            typeof entry === 'object'
                                ? entry.id
                                : Number(entry),
                        )
                        .filter((id): id is number => Number.isFinite(id));
                    this.loadedAt = Date.now();
                    return this.ids;
                } finally {
                    this.loading = null;
                }
            })();
            return this.loading;
        },
        async setIds(ids: number[]): Promise<void> {
            const previous = this.ids;
            this.ids = ids;
            this.loadedAt = Date.now();
            try {
                await externalApi.put('/default-circles', {
                    circle_ids: ids.map((id) => Number(id)),
                });
            } catch (error) {
                this.ids = previous;
                throw error;
            }
        },
        invalidate(): void {
            this.loadedAt = 0;
        },
        clear(): void {
            this.ids = null;
            this.loadedAt = 0;
        },
    },
});
