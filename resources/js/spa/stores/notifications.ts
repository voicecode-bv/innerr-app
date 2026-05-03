import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

const DEFAULT_TTL_MS = 60 * 1000;

export const useNotificationsStore = defineStore('spa-notifications', {
    state: () => ({
        unreadCount: 0,
        loadedAt: 0,
        loading: null as Promise<number> | null,
    }),
    actions: {
        async ensureLoaded(maxAgeMs: number = DEFAULT_TTL_MS): Promise<number> {
            if (this.loadedAt > 0 && Date.now() - this.loadedAt < maxAgeMs) {
                return this.unreadCount;
            }
            return this.refresh();
        },
        async refresh(): Promise<number> {
            if (this.loading) return this.loading;
            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{ count: number }>(
                        '/notifications/unread-count',
                    );
                    this.unreadCount = resp.count;
                    this.loadedAt = Date.now();
                    return this.unreadCount;
                } finally {
                    this.loading = null;
                }
            })();
            return this.loading;
        },
        markAllRead(): void {
            this.unreadCount = 0;
            this.loadedAt = Date.now();
        },
        decrement(by: number = 1): void {
            this.unreadCount = Math.max(0, this.unreadCount - by);
        },
        invalidate(): void {
            this.loadedAt = 0;
        },
        clear(): void {
            this.unreadCount = 0;
            this.loadedAt = 0;
        },
    },
});
