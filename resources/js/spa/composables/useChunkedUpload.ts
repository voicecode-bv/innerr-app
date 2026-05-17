import type { ExifData } from '@/composables/useExif';
import { api } from '@/spa/http/apiClient';

interface InitResponse {
    upload_id: string;
    chunk_size: number;
    max_chunks: number;
}

interface ChunkResponse {
    path?: string;
    received?: boolean;
}

/**
 * Splits a binary blob into ~1 MB base64 chunks and uploads them sequentially
 * via the BFF upload-session endpoints. The last chunk carries the EXIF
 * metadata + the `final: true` flag which triggers server-side assembly and
 * returns the cropped media path that can be passed to /api/spa/posts.
 *
 * WKWebView strips multipart bodies, hence base64-in-JSON. Sequential upload
 * keeps PHP memory bounded — one chunk in flight at a time rather than the
 * whole 20 MB image in one request.
 */
export async function uploadInChunks(
    blob: Blob,
    exif: ExifData,
    onProgress?: (sent: number, total: number) => void,
): Promise<string> {
    const init = await api.post<InitResponse>('/posts/upload-session');
    const { upload_id, chunk_size, max_chunks } = init;

    const total = blob.size;
    const chunkCount = Math.max(1, Math.ceil(total / chunk_size));

    if (chunkCount > max_chunks) {
        await abort(upload_id);

        throw new Error(
            `File too large: ${chunkCount} chunks > max ${max_chunks}`,
        );
    }

    try {
        for (let i = 0; i < chunkCount; i++) {
            const start = i * chunk_size;
            const end = Math.min(start + chunk_size, total);
            const slice = blob.slice(start, end);
            const base64 = await blobToBase64(slice);
            const isFinal = i === chunkCount - 1;

            const body: Record<string, unknown> = {
                sequence: i,
                data: base64,
                final: isFinal,
            };

            if (isFinal) {
                if (exif.taken_at) {
                    body.taken_at = exif.taken_at;
                }

                if (exif.latitude !== null) {
                    body.latitude = exif.latitude;
                }

                if (exif.longitude !== null) {
                    body.longitude = exif.longitude;
                }
            }

            const response = await api.post<ChunkResponse>(
                `/posts/upload-session/${upload_id}/chunk`,
                body,
            );

            onProgress?.(end, total);

            if (isFinal) {
                if (!response.path) {
                    throw new Error('Finalize response missing path');
                }

                return response.path;
            }
        }

        throw new Error('Unreachable: loop exited without final chunk');
    } catch (error) {
        await abort(upload_id);

        throw error;
    }
}

async function abort(uploadId: string): Promise<void> {
    try {
        await api.delete(`/posts/upload-session/${uploadId}`);
    } catch {
        // best-effort cleanup; server-side GC will sweep stale sessions.
    }
}

// Reads the blob as a base64 string without the data:...;base64, prefix.
// FileReader.readAsDataURL is the only browser API that handles large blobs
// without manual byte-walking and stays off the main thread.
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () =>
            reject(reader.error ?? new Error('FileReader error'));
        reader.onload = () => {
            const result = reader.result;

            if (typeof result !== 'string') {
                reject(new Error('Unexpected reader result'));

                return;
            }

            const commaIndex = result.indexOf(',');
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.readAsDataURL(blob);
    });
}
