import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

export interface Circle {
    id: number;
    name: string;
    photo: string | null;
    members_count?: number;
    members_can_invite?: boolean;
    is_owner?: boolean;
    created_at?: string;
}

const STORAGE_KEY = 'spa.circles.cache';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function readWarmCache(): Circle[] | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Circle[]) : null;
    } catch {
        return null;
    }
}

function writeWarmCache(items: Circle[] | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (items === null) {
            window.localStorage?.removeItem(STORAGE_KEY);
        } else {
            window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items));
        }
    } catch {
        // negeren — quotum vol of private mode
    }
}

export const useCirclesStore = defineStore('spa-circles', {
    state: () => ({
        items: readWarmCache(),
        loadedAt: 0,
        loading: null as Promise<Circle[]> | null,
    }),
    actions: {
        async ensureLoaded(
            maxAgeMs: number = DEFAULT_TTL_MS,
        ): Promise<Circle[]> {
            if (this.items && Date.now() - this.loadedAt < maxAgeMs) {
                return this.items;
            }
            return this.refresh();
        },
        async refresh(): Promise<Circle[]> {
            if (this.loading) return this.loading;
            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{ data: Circle[] }>(
                        '/circles',
                    );
                    this.items = resp.data;
                    this.loadedAt = Date.now();
                    writeWarmCache(this.items);
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
        prepend(circle: Circle): void {
            this.items = [circle, ...(this.items ?? [])];
            writeWarmCache(this.items);
        },
        update(id: number, patch: Partial<Circle>): void {
            if (!this.items) return;
            this.items = this.items.map((c) =>
                c.id === id ? { ...c, ...patch } : c,
            );
            writeWarmCache(this.items);
        },
        remove(id: number): void {
            if (!this.items) return;
            this.items = this.items.filter((c) => c.id !== id);
            writeWarmCache(this.items);
        },
        clear(): void {
            this.items = null;
            this.loadedAt = 0;
            writeWarmCache(null);
        },
    },
});
