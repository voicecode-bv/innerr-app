import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

export interface Tag {
    id: number;
    name: string;
    usage_count: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const useTagsStore = defineStore('spa-tags', {
    state: () => ({
        items: null as Tag[] | null,
        loadedAt: 0,
        loading: null as Promise<Tag[]> | null,
    }),
    actions: {
        async ensureLoaded(maxAgeMs: number = DEFAULT_TTL_MS): Promise<Tag[]> {
            if (this.items && Date.now() - this.loadedAt < maxAgeMs) {
                return this.items;
            }
            return this.refresh();
        },
        async refresh(): Promise<Tag[]> {
            if (this.loading) return this.loading;
            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{ data: Tag[] }>(
                        '/tags',
                    );
                    this.items = resp.data;
                    this.loadedAt = Date.now();
                    return this.items;
                } finally {
                    this.loading = null;
                }
            })();
            return this.loading;
        },
        invalidate(): void {
            this.loadedAt = 0;
        },
        prepend(tag: Tag): void {
            this.items = [tag, ...(this.items ?? [])];
        },
        update(id: number, patch: Partial<Tag>): void {
            if (!this.items) return;
            this.items = this.items.map((t) =>
                t.id === id ? { ...t, ...patch } : t,
            );
        },
        remove(id: number): void {
            if (!this.items) return;
            this.items = this.items.filter((t) => t.id !== id);
        },
        clear(): void {
            this.items = null;
            this.loadedAt = 0;
        },
    },
});
