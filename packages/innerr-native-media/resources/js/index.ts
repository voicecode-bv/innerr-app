/**
 * innerr/native-media — JS bridge for the NativeMedia plugin.
 *
 * Strategy: instead of base64-encoding videos through PHP (which OOM-kills the
 * embedded PHP process on iOS for files >~30 MB), we stage the file natively
 * into the WebView's existing public-asset serving path. The bridge returns a
 * URL the WebView can fetch directly, with proper range support and streaming.
 *
 * Thumbnails are small enough to come back inline as a base64 data URL.
 */
import { BridgeCall } from '@nativephp/mobile';

export interface StagedMedia {
    /** URL the WebView can load directly, e.g. `/_assets/_media/abc123.mov`. */
    url: string;
    /** Opaque handle to pass to `release()` when done. */
    token: string;
    mime: string;
    size: number;
}

export interface MediaThumbnail {
    /** `data:image/jpeg;base64,...` — ready for `<img src>` or `<video poster>`. */
    dataUrl: string;
    width: number;
    height: number;
    mime: 'image/jpeg';
}

export interface ThumbnailOptions {
    /** Longest edge of the output JPEG in pixels (default 512). */
    maxSize?: number;
    /** For videos: which timestamp to grab the frame from (default 0.1s). */
    timeSeconds?: number;
}

/**
 * Stage a local file under the WebView-serveable assets directory. Returns a
 * URL the WebView can fetch directly without going through PHP.
 *
 * Hard-links when possible (instant, no extra disk); falls back to a copy
 * across volumes.
 */
export async function stage(
    path: string,
    mime?: string,
): Promise<StagedMedia> {
    const params: { path: string; mime?: string } = { path };

    if (mime) {
        params.mime = mime;
    }

    return BridgeCall('NativeMedia.Stage', params);
}

/**
 * Generate a thumbnail (JPEG data URL) for an image or video file using
 * native frameworks (AVAssetImageGenerator on iOS, MediaMetadataRetriever on
 * Android). The result is small enough to inline.
 */
export async function thumbnail(
    path: string,
    options: ThumbnailOptions = {},
): Promise<MediaThumbnail> {
    const params: {
        path: string;
        maxSize?: number;
        timeSeconds?: number;
    } = { path };

    if (options.maxSize !== undefined) {
        params.maxSize = options.maxSize;
    }

    if (options.timeSeconds !== undefined) {
        params.timeSeconds = options.timeSeconds;
    }

    return BridgeCall('NativeMedia.Thumbnail', params);
}

/**
 * Delete the staged copy of a file. Safe to call multiple times.
 */
export async function release(token: string): Promise<void> {
    await BridgeCall('NativeMedia.Release', { token });
}

export const NativeMedia = {
    stage,
    thumbnail,
    release,
};

export default NativeMedia;
