import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const useDefaultCirclesStore = defineStore('spa-default-circles', {
    state: () => ({
        ids: null as string[] | null,
        loadedAt: 0,
        loading: null as Promise<string[]> | null,
    }),
    actions: {
        async ensureLoaded(
            maxAgeMs: number = DEFAULT_TTL_MS,
        ): Promise<string[]> {
            if (this.ids && Date.now() - this.loadedAt < maxAgeMs) {
                return this.ids;
            }

            return this.refresh();
        },
        async refresh(): Promise<string[]> {
            if (this.loading) {
                return this.loading;
            }

            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{
                        data: Array<string | { id: string }>;
                    }>('/default-circles');
                    // Externe API kan IDs als strings OF als objecten met `id` retourneren —
                    // normaliseer naar strings.
                    this.ids = (resp.data ?? [])
                        .map((entry) =>
                            typeof entry === 'object' ? entry.id : entry,
                        )
                        .filter(
                            (id): id is string =>
                                typeof id === 'string' && id !== '',
                        );
                    this.loadedAt = Date.now();

                    return this.ids;
                } finally {
                    this.loading = null;
                }
            })();

            return this.loading;
        },
        async setIds(ids: string[]): Promise<void> {
            const previous = this.ids;
            this.ids = ids;
            this.loadedAt = Date.now();

            try {
                await externalApi.put('/default-circles', {
                    circle_ids: ids,
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
