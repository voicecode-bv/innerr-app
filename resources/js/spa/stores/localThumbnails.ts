import { defineStore } from 'pinia';

/**
 * Client-side store of locally generated post thumbnails (data URLs from
 * `NativeMedia.thumbnail`), indexed by the real post id as returned by the
 * server.
 *
 * Use case: at the time of a notification or profile grid the backend may
 * not yet have a CDN poster for a just-uploaded video (transcoding still in
 * progress). By using the locally generated JPEG thumbnail as a fallback,
 * those views immediately show something usable instead of an empty box.
 *
 * Capped at 64 entries (FIFO) so the store does not grow unbounded; on a
 * fresh app start the store is empty and every client falls back to the real
 * server thumbnails — which are ready by then.
 */

const STORAGE_KEY = 'spa.local-thumbnails.v1';
const MAX_ENTRIES = 64;

interface LocalThumbnailEntry {
    dataUrl: string;
    createdAt: number;
}

function readStorage(): Record<string, LocalThumbnailEntry> {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);

        return raw
            ? (JSON.parse(raw) as Record<string, LocalThumbnailEntry>)
            : {};
    } catch {
        return {};
    }
}

function writeStorage(value: Record<string, LocalThumbnailEntry>): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
        // ignore — quota full or private mode
    }
}

export const useLocalThumbnailsStore = defineStore('spa-local-thumbnails', {
    state: () => ({
        entries: readStorage(),
    }),
    actions: {
        get(postId: string): string | null {
            return this.entries[postId]?.dataUrl ?? null;
        },
        set(postId: string, dataUrl: string): void {
            this.entries[postId] = { dataUrl, createdAt: Date.now() };

            // FIFO trim — remove the oldest entries once we exceed the cap.
            const ids = Object.keys(this.entries);

            if (ids.length > MAX_ENTRIES) {
                const sorted = ids
                    .map((id) => ({
                        id,
                        createdAt: this.entries[id]!.createdAt,
                    }))
                    .sort((a, b) => a.createdAt - b.createdAt);

                for (const { id } of sorted.slice(
                    0,
                    ids.length - MAX_ENTRIES,
                )) {
                    delete this.entries[id];
                }
            }

            writeStorage(this.entries);
        },
        remove(postId: string): void {
            if (postId in this.entries) {
                delete this.entries[postId];
                writeStorage(this.entries);
            }
        },
    },
});
