import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';
import { setBadge } from '@voicecode-bv/nativephp-badge';

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
            if (this.loading) {
                return this.loading;
            }

            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{ count: number }>(
                        '/notifications/unread-count',
                    );
                    this.unreadCount = resp.count;
                    this.loadedAt = Date.now();
                    this.syncIconBadge();

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
            this.syncIconBadge();
        },
        /**
         * Set the unread count to an exact value. Used when marking the feed read
         * leaves actionable items (pending circle invitations, ownership transfer
         * requests) that intentionally stay unread until accepted or declined.
         */
        setUnreadCount(count: number): void {
            this.unreadCount = Math.max(0, count);
            this.loadedAt = Date.now();
            this.syncIconBadge();
        },
        decrement(by: number = 1): void {
            this.unreadCount = Math.max(0, this.unreadCount - by);
            this.syncIconBadge();
        },
        invalidate(): void {
            this.loadedAt = 0;
        },
        clear(): void {
            this.unreadCount = 0;
            this.loadedAt = 0;
            this.syncIconBadge();
        },
        /**
         * Mirror the unread count onto the native app icon badge so it stays in
         * sync with in-app reads (iOS does not decrement the badge on its own).
         * No-op on web/desktop where the native bridge is unavailable; the
         * underlying bridge call rejects there and we swallow it.
         */
        syncIconBadge(): void {
            void setBadge(this.unreadCount).catch(() => {
                // Bridge unavailable (web/desktop) or native error; not critical.
            });
        },
    },
});
