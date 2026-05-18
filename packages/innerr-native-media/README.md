# innerr/native-media

NativePHP Mobile plugin that stages local media files for direct WebView consumption and generates thumbnails for images and videos using native frameworks.

## Why this exists

NativePHP iOS routes WebView requests through a `PHPSchemeHandler` that does a UTF-8 string round-trip when forwarding to embedded PHP. Binary bytes don't survive that, so serving a video file via a Laravel route forces a base64-data-URL workaround. For files above ~30 MB the in-process PHP allocations push the iOS app over its memory budget and the OS kills the process mid-response — the WebView ends up with headers but a zero-byte body.

This plugin bypasses PHP entirely for media:

- **`stage(path)`** hard-links (or copies) the file into the WebView's existing `/_assets/...` directory. The native scheme handler already serves that path with range support and chunked streaming. You get back a URL like `/_assets/_media/abc123.mov` that you can put straight into `<video src>` / `<img src>`.
- **`thumbnail(path)`** uses `AVAssetImageGenerator` (iOS) / `MediaMetadataRetriever` (Android) to extract a JPEG poster frame natively, returned as a small base64 data URL. Much cheaper than a `<video>`+canvas frame-grab in JS.
- **`release(token)`** deletes a previously staged copy.

## Installation

This package is shipped inside the host app's `packages/` directory and installed via a local path repository.

`composer.json`:

```json
{
    "repositories": [
        {
            "type": "path",
            "url": "packages/innerr-native-media",
            "options": { "symlink": true }
        }
    ],
    "require": {
        "innerr/native-media": "^1.0"
    }
}
```

`vite.config.ts`:

```ts
resolve: {
    alias: {
        '@innerr/native-media': path.resolve(__dirname, 'packages/innerr-native-media/resources/js/index.ts'),
    },
}
```

`tsconfig.json`:

```json
{
    "compilerOptions": {
        "paths": {
            "@innerr/native-media": ["./packages/innerr-native-media/resources/js/index.ts"]
        }
    },
    "include": [
        "packages/innerr-native-media/resources/js/**/*.ts"
    ]
}
```

After `composer require`, rebuild the iOS/Android NativePHP app so the Swift/Kotlin sources get compiled into the native project.

## Usage

```ts
import { NativeMedia } from '@innerr/native-media';

// Stage a local file for direct WebView playback
const staged = await NativeMedia.stage(path, mimeType);
videoElement.src = staged.url;          // e.g. "/_assets/_media/abc123.mov"

// Generate a poster thumbnail
const thumb = await NativeMedia.thumbnail(path, {
    maxSize: 512,
    timeSeconds: 0.1,
});
videoElement.poster = thumb.dataUrl;

// Clean up when the file is no longer needed
await NativeMedia.release(staged.token);
```

## API

### `NativeMedia.stage(path, mime?)`

Stages a local file under the WebView-serveable assets directory.

**Parameters:**
- `path: string` — absolute local file path (e.g. from `Camera.recordVideo()`)
- `mime?: string` — optional MIME hint; inferred from extension if omitted

**Returns:** `Promise<{ url, token, mime, size }>`
- `url` — relative URL the WebView can fetch directly (e.g. `/_assets/_media/abc123.mov`)
- `token` — opaque handle to pass to `release()`
- `mime` — resolved MIME type
- `size` — file size in bytes

**Performance:** hard-links via `linkItem` (iOS) / `Files.createLink` (Android) when possible — instant, zero extra disk. Falls back to a copy across volumes.

### `NativeMedia.thumbnail(path, options?)`

Generates a JPEG thumbnail for an image or video file.

**Parameters:**
- `path: string` — absolute local file path
- `options.maxSize?: number` — longest edge in pixels (default `512`)
- `options.timeSeconds?: number` — for videos: frame timestamp to grab (default `0.1`)

**Returns:** `Promise<{ dataUrl, width, height, mime }>`
- `dataUrl` — `data:image/jpeg;base64,...` ready for `<img src>` or `<video poster>`
- `width`, `height` — output dimensions in pixels
- `mime` — always `image/jpeg`

**Detection:** video vs image inferred from extension (`mov`/`mp4`/`m4v`/`webm`/`avi` → video; `jpg`/`jpeg`/`png`/`heic`/`heif`/`gif`/`webp` → image), with UTType fallback on iOS.

### `NativeMedia.release(token)`

Deletes a previously staged copy. Safe to call multiple times.

**Parameters:**
- `token: string` — the token returned by `stage()`

**Returns:** `Promise<void>`

## How staging works

The plugin writes files to `Documents/app/public/_media/<token>.<ext>` on iOS and the platform equivalent on Android. The existing NativePHP scheme handler resolves `/_assets/...` URLs against that directory and serves them with:

- Proper `Content-Type` from the file extension
- `Accept-Ranges: bytes` for scrubbing
- 1 MB chunked streaming for files >10 MB
- 206 Partial Content responses for range requests

No PHP code runs, no UTF-8 round-trip happens, no base64 encoding is needed.

## Cleanup discipline

Staged files persist on disk until you call `release(token)` or the app is uninstalled. Recommended pattern:

```ts
// Track tokens on each staged item
const items = ref<{ stagedToken?: string }[]>([]);

// Release when removing an item
function remove(i: number) {
    const [gone] = items.value.splice(i, 1);
    if (gone?.stagedToken) {
        void NativeMedia.release(gone.stagedToken);
    }
}

// Release leftovers on unmount
onUnmounted(() => {
    for (const item of items.value) {
        if (item.stagedToken) {
            void NativeMedia.release(item.stagedToken);
        }
    }
});
```

## Platform requirements

- iOS 18.2+
- Android API 26+
- NativePHP Mobile 3.x

## License

MIT
