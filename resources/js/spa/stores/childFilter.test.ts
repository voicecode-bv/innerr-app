import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const apiPut = vi.fn();

vi.mock('@/spa/http/externalApi', () => ({
    externalApi: {
        get: (path: string) => apiGet(path),
        put: (path: string, body: unknown) => apiPut(path, body),
    },
}));

const { useChildFilterStore } = await import('./childFilter');

beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    apiGet.mockReset();
    apiPut.mockReset();
});

describe('child filter store', () => {
    it('hydrates the selection from the server', async () => {
        apiGet.mockResolvedValue({ data: ['child-1', 'child-2'] });

        const store = useChildFilterStore();
        await store.ensureLoaded();

        expect(apiGet).toHaveBeenCalledWith('/child-filter');
        expect(store.selectedIds).toEqual(['child-1', 'child-2']);
    });

    it('keeps the local value when the server is unreachable', async () => {
        apiGet.mockRejectedValue(new Error('offline'));

        const store = useChildFilterStore();
        store.selectedIds = ['child-1'];
        await store.ensureLoaded();

        expect(store.selectedIds).toEqual(['child-1']);
    });

    it('retries after a failed refresh', async () => {
        apiGet.mockRejectedValueOnce(new Error('offline'));
        apiGet.mockResolvedValueOnce({ data: ['child-2'] });

        const store = useChildFilterStore();
        await store.ensureLoaded();
        await store.ensureLoaded();

        expect(apiGet).toHaveBeenCalledTimes(2);
        expect(store.selectedIds).toEqual(['child-2']);
    });

    it('does not refetch within the TTL', async () => {
        apiGet.mockResolvedValue({ data: [] });

        const store = useChildFilterStore();
        await store.ensureLoaded();
        await store.ensureLoaded();

        expect(apiGet).toHaveBeenCalledTimes(1);
    });

    it('keeps the same array reference when the server matches', async () => {
        apiGet.mockResolvedValue({ data: ['child-1'] });

        const store = useChildFilterStore();
        store.selectedIds = ['child-1'];
        const before = store.selectedIds;
        await store.refresh();

        // The feeds watch this by reference; an equal-but-new array would
        // trigger a needless feed reset.
        expect(store.selectedIds).toBe(before);
    });

    it('persists a new selection to the server optimistically', () => {
        apiPut.mockResolvedValue({ data: ['child-1'] });

        const store = useChildFilterStore();
        store.setSelected(['child-1']);

        expect(store.selectedIds).toEqual(['child-1']);
        expect(apiPut).toHaveBeenCalledWith('/child-filter', {
            person_ids: ['child-1'],
        });
    });

    it('keeps the local selection when persisting fails', async () => {
        apiPut.mockRejectedValue(new Error('offline'));

        const store = useChildFilterStore();
        store.setSelected(['child-1']);
        await Promise.resolve();

        expect(store.selectedIds).toEqual(['child-1']);
    });
});
