import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const setBadge = vi.fn();

vi.mock('@/spa/http/externalApi', () => ({
    externalApi: {
        get: (path: string) => apiGet(path),
    },
}));

vi.mock('@voicecode-bv/nativephp-badge', () => ({
    setBadge: (count: number) => {
        setBadge(count);

        return Promise.resolve();
    },
}));

const { useNotificationsStore } = await import('./notifications');

beforeEach(() => {
    setActivePinia(createPinia());
    apiGet.mockReset();
    setBadge.mockReset();
});

describe('notifications store unread count', () => {
    it('keeps pending actionable items counted via setUnreadCount', () => {
        const store = useNotificationsStore();
        store.unreadCount = 7;

        // Marking the feed read leaves two pending circle invitations unread.
        store.setUnreadCount(2);

        expect(store.unreadCount).toBe(2);
        expect(setBadge).toHaveBeenLastCalledWith(2);
    });

    it('never sets a negative count', () => {
        const store = useNotificationsStore();

        store.setUnreadCount(-3);

        expect(store.unreadCount).toBe(0);
    });

    it('decrements toward zero without going negative', () => {
        const store = useNotificationsStore();
        store.setUnreadCount(1);

        store.decrement();
        store.decrement();

        expect(store.unreadCount).toBe(0);
        expect(setBadge).toHaveBeenLastCalledWith(0);
    });
});
