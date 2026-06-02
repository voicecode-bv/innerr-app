import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

interface ServiceKeys {
    mapbox?: { public_token?: string | null };
    [key: string]: unknown;
}

interface CacheEntry {
    keys: ServiceKeys;
    fetched_at: number;
}

const STORAGE_KEY = 'spa.service_keys';
const TTL_MS = 60 * 60 * 1000; // 1 uur — Mapbox-token verandert zelden

function readCache(): CacheEntry | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as CacheEntry;

        if (Date.now() - parsed.fetched_at > TTL_MS) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function writeCache(entry: CacheEntry): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
        // quota exceeded — silent
    }
}

export const useServiceKeysStore = defineStore('spa-service-keys', {
    state: () => ({
        keys: null as ServiceKeys | null,
        loading: false,
    }),
    getters: {
        mapboxToken(state): string | null {
            return state.keys?.mapbox?.public_token ?? null;
        },
    },
    actions: {
        async ensureLoaded(): Promise<ServiceKeys> {
            if (this.keys) {
                return this.keys;
            }

            const cached = readCache();

            if (cached) {
                this.keys = cached.keys;

                return this.keys;
            }

            return this.refresh();
        },

        async refresh(): Promise<ServiceKeys> {
            if (this.loading && this.keys) {
                return this.keys;
            }

            this.loading = true;

            try {
                const data =
                    await externalApi.get<ServiceKeys>('/service-keys');
                this.keys = data;
                writeCache({ keys: data, fetched_at: Date.now() });

                return data;
            } finally {
                this.loading = false;
            }
        },
    },
});
