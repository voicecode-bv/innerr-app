import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

export interface Person {
    id: string;
    name: string;
    birthdate: string | null;
    avatar: string | null;
    avatar_thumbnail: string | null;
    usage_count: number;
    user_id?: string | null;
    created_by_user_id?: string;
    circle_ids?: string[];
    parents?: {
        id: string;
        name: string;
        username: string;
        avatar_thumbnail: string | null;
    }[];
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const usePersonsStore = defineStore('spa-persons', {
    state: () => ({
        items: null as Person[] | null,
        loadedAt: 0,
        loading: null as Promise<Person[]> | null,
    }),
    actions: {
        async ensureLoaded(
            maxAgeMs: number = DEFAULT_TTL_MS,
        ): Promise<Person[]> {
            if (this.items && Date.now() - this.loadedAt < maxAgeMs) {
                return this.items;
            }

            return this.refresh();
        },
        async refresh(): Promise<Person[]> {
            if (this.loading) {
                return this.loading;
            }

            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{ data: Person[] }>(
                        '/persons',
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
        prepend(person: Person): void {
            this.items = [person, ...(this.items ?? [])];
        },
        update(id: string, patch: Partial<Person>): void {
            if (!this.items) {
                return;
            }

            this.items = this.items.map((p) =>
                p.id === id ? { ...p, ...patch } : p,
            );
        },
        remove(id: string): void {
            if (!this.items) {
                return;
            }

            this.items = this.items.filter((p) => p.id !== id);
        },
        clear(): void {
            this.items = null;
            this.loadedAt = 0;
        },
    },
});
