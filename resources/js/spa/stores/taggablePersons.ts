import { defineStore } from 'pinia';
import { externalApi, ApiError } from '@/spa/http/externalApi';

export interface TaggablePerson {
    id: number;
    name: string;
    avatar: string | null;
    avatar_thumbnail: string | null;
    user_id?: number | null;
    created_by_user_id?: number | null;
}

interface CacheEntry {
    items: TaggablePerson[];
    loadedAt: number;
}

const DEFAULT_TTL_MS = 2 * 60 * 1000;

function cacheKey(circleIds: number[]): string {
    // Stable key: sorted ids, joined. `[2,1]` en `[1,2]` delen zo één cache-entry.
    return [...circleIds]
        .map((id) => Number(id))
        .sort((a, b) => a - b)
        .join(',');
}

function buildQuery(circleIds: number[]): string {
    // Laravel verwacht `circle_ids[]=1&circle_ids[]=2`. URLSearchParams.append
    // produceert `circle_ids=1&circle_ids=2` zonder de `[]` — dus zelf bouwen.
    const parts = circleIds.map(
        (id) => `circle_ids%5B%5D=${encodeURIComponent(String(id))}`,
    );
    return parts.join('&');
}

export const useTaggablePersonsStore = defineStore('spa-taggable-persons', {
    state: () => ({
        cache: {} as Record<string, CacheEntry>,
        loading: {} as Record<string, Promise<TaggablePerson[]> | undefined>,
        lastError: null as { status: number; message: string } | null,
    }),
    actions: {
        async load(
            circleIds: number[],
            maxAgeMs: number = DEFAULT_TTL_MS,
        ): Promise<TaggablePerson[]> {
            if (circleIds.length === 0) {
                this.lastError = null;
                return [];
            }

            const key = cacheKey(circleIds);
            const cached = this.cache[key];
            if (cached && Date.now() - cached.loadedAt < maxAgeMs) {
                this.lastError = null;
                return cached.items;
            }

            const inflight = this.loading[key];
            if (inflight) return inflight;

            const promise = (async () => {
                try {
                    const resp = await externalApi.get<{
                        data: TaggablePerson[];
                    }>(`/persons/taggable?${buildQuery(circleIds)}`);
                    this.cache[key] = {
                        items: resp.data,
                        loadedAt: Date.now(),
                    };
                    this.lastError = null;
                    return resp.data;
                } catch (error) {
                    if (error instanceof ApiError) {
                        this.lastError = {
                            status: error.status,
                            message: error.message,
                        };
                    }
                    throw error;
                } finally {
                    delete this.loading[key];
                }
            })();

            this.loading[key] = promise;
            return promise;
        },
        get(circleIds: number[]): TaggablePerson[] | null {
            if (circleIds.length === 0) return [];
            return this.cache[cacheKey(circleIds)]?.items ?? null;
        },
        invalidate(): void {
            this.cache = {};
            this.lastError = null;
        },
        clear(): void {
            this.cache = {};
            this.loading = {};
            this.lastError = null;
        },
    },
});
