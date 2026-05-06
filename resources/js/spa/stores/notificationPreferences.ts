import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

export interface NotificationPreferences {
    post_liked: boolean;
    post_commented: boolean;
    comment_liked: boolean;
    comment_replied: boolean;
    new_circle_post: boolean;
    post_tagged: boolean;
    circle_invitation_received: boolean;
    circle_invitation_accepted: boolean;
    circle_ownership_transfer_requested: boolean;
    circle_ownership_transfer_accepted: boolean;
    circle_ownership_transfer_declined: boolean;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export const useNotificationPreferencesStore = defineStore(
    'spa-notification-preferences',
    {
        state: () => ({
            preferences: null as NotificationPreferences | null,
            loadedAt: 0,
            loading: null as Promise<NotificationPreferences> | null,
        }),
        actions: {
            async ensureLoaded(
                maxAgeMs: number = DEFAULT_TTL_MS,
            ): Promise<NotificationPreferences> {
                if (this.preferences && Date.now() - this.loadedAt < maxAgeMs) {
                    return this.preferences;
                }
                return this.refresh();
            },
            async refresh(): Promise<NotificationPreferences> {
                if (this.loading) return this.loading;
                this.loading = (async () => {
                    try {
                        const resp = await externalApi.get<{
                            data: NotificationPreferences;
                        }>('/notification-preferences');
                        this.preferences = resp.data;
                        this.loadedAt = Date.now();
                        return this.preferences;
                    } finally {
                        this.loading = null;
                    }
                })();
                return this.loading;
            },
            async toggle(key: keyof NotificationPreferences): Promise<void> {
                if (!this.preferences) return;
                const previous = { ...this.preferences };
                this.preferences = {
                    ...this.preferences,
                    [key]: !this.preferences[key],
                };
                try {
                    await externalApi.put(
                        '/notification-preferences',
                        this.preferences,
                    );
                } catch (error) {
                    this.preferences = previous;
                    throw error;
                }
            },
            invalidate(): void {
                this.loadedAt = 0;
            },
            clear(): void {
                this.preferences = null;
                this.loadedAt = 0;
            },
        },
    },
);
