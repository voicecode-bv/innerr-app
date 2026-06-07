import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

export interface CirclePendingInvitation {
    id: string;
    email: string | null;
    username: string | null;
    inviter_id: string;
    can_cancel: boolean;
    created_at: string;
}

export interface Circle {
    id: string;
    name: string;
    photo: string | null;
    members_count?: number;
    members_can_invite?: boolean;
    members_can_view_members?: boolean;
    members_can_download?: boolean;
    auto_add_new_users?: boolean;
    is_owner?: boolean;
    is_administrator?: boolean;
    created_at?: string;
    updated_at?: string;
    pending_invitations?: CirclePendingInvitation[];
}

/**
 * Most recently changed circle first, based on `updated_at`. Falls back to
 * `created_at`, then name, so warm-cache entries from older app versions that
 * predate the `updated_at` field still sort deterministically. Returns a new
 * array; the input is left untouched.
 */
export function sortByRecentlyUpdated(circles: readonly Circle[]): Circle[] {
    const timestamp = (circle: Circle): number => {
        const value = circle.updated_at ?? circle.created_at;

        return value ? Date.parse(value) : 0;
    };

    return [...circles].sort((a, b) => {
        const diff = timestamp(b) - timestamp(a);

        return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
}

const STORAGE_KEY = 'spa.circles.cache.v2';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function readWarmCache(): Circle[] | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);

        return raw ? (JSON.parse(raw) as Circle[]) : null;
    } catch {
        return null;
    }
}

function writeWarmCache(items: Circle[] | null): void {
    if (typeof window === 'undefined') {
        return;
    }

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
            if (this.loading) {
                return this.loading;
            }

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
        update(id: string, patch: Partial<Circle>): void {
            if (!this.items) {
                return;
            }

            this.items = this.items.map((c) =>
                c.id === id ? { ...c, ...patch } : c,
            );
            writeWarmCache(this.items);
        },
        remove(id: string): void {
            if (!this.items) {
                return;
            }

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
