import { defineStore } from 'pinia';

/**
 * Client-side store van lokaal gegenereerde post-thumbnails (data-URLs uit
 * `NativeMedia.thumbnail`), geïndexeerd op de echte post-id zoals de server
 * die teruggeeft.
 *
 * Use case: het backend kan op het moment van een notificatie of profiel-grid
 * nog geen CDN-poster hebben voor een net ge-uploade video (transcoding loopt
 * nog). Pakken we de lokaal gegenereerde JPEG-thumbnail als fallback, dan
 * tonen die views direct iets bruikbaars in plaats van een leeg vakje.
 *
 * Beperkt tot 64 entries (FIFO) zodat de store niet ongebonden groeit; bij
 * een fresh app-start is de store leeg en valt elk client terug op de echte
 * server-thumbnails — die zijn dan inmiddels klaar.
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
        // negeer — quotum vol of private mode
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

            // FIFO trim — verwijder de oudste entries zodra we boven de cap zitten.
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
