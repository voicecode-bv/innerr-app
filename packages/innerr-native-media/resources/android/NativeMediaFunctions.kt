package app.innerr.nativemedia

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.fragment.app.FragmentActivity
import com.nativephp.mobile.bridge.BridgeError
import com.nativephp.mobile.bridge.BridgeFunction
import com.nativephp.mobile.bridge.BridgeResponse
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.UUID

/**
 * Functions related to staging local media files into the NativePHP public assets dir
 * so the WebView's existing `_assets/...` fast path can serve them with proper
 * Content-Type and range support — bypassing the PHP forwarding path which
 * corrupts binary bytes (videos in particular).
 *
 * Namespace: "NativeMedia.*"
 */
object NativeMediaFunctions {

    private const val MEDIA_SUBDIR = "_media"

    // ─────────────────────────────────────────────────────────────────────────
    // Path / MIME helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Resolve the Laravel public path. Mirrors PHPBridge.getLaravelPublicPath()
     * which (per the native php_bridge.c) returns:
     *     context.getDir("storage", MODE_PRIVATE).absolutePath + "/laravel/public"
     */
    private fun resolvePublicPath(context: Context): File {
        val storageDir = context.getDir("storage", Context.MODE_PRIVATE)
        return File(storageDir, "laravel/public")
    }

    private fun resolveMediaDir(context: Context): File {
        val mediaDir = File(resolvePublicPath(context), MEDIA_SUBDIR)
        if (!mediaDir.exists()) {
            if (!mediaDir.mkdirs() && !mediaDir.exists()) {
                throw BridgeError.ExecutionFailed(
                    "Unable to create media staging dir at ${mediaDir.absolutePath}"
                )
            }
        }
        return mediaDir
    }

    private fun extensionFor(path: String): String {
        val name = path.substringAfterLast('/')
        val ext = name.substringAfterLast('.', missingDelimiterValue = "").lowercase()
        return if (ext.isEmpty()) "bin" else ext
    }

    private fun mimeFor(extension: String): String {
        return when (extension.lowercase()) {
            // images
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "heic" -> "image/heic"
            "heif" -> "image/heif"
            "bmp" -> "image/bmp"
            // video
            "mp4", "m4v" -> "video/mp4"
            "mov" -> "video/quicktime"
            "webm" -> "video/webm"
            "avi" -> "video/x-msvideo"
            "3gp" -> "video/3gpp"
            "mkv" -> "video/x-matroska"
            // audio
            "mp3" -> "audio/mpeg"
            "m4a" -> "audio/mp4"
            "wav" -> "audio/wav"
            "ogg" -> "audio/ogg"
            else -> "application/octet-stream"
        }
    }

    private fun isVideoExtension(extension: String): Boolean {
        return extension.lowercase() in setOf("mov", "mp4", "m4v", "webm", "avi", "3gp", "mkv")
    }

    private fun isImageExtension(extension: String): Boolean {
        return extension.lowercase() in setOf("jpg", "jpeg", "png", "heic", "heif", "gif", "webp", "bmp")
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Stage
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Stage a local file into the public assets dir so it can be served by the
     * WebView's `_assets/...` fast path.
     *
     * Parameters:
     *   - path: (required) string - Absolute local file path (e.g. from camera / gallery)
     *   - mime: (optional) string - Caller-supplied MIME hint; if absent, derived from extension
     *
     * Returns:
     *   - url:   string - `/_assets/_media/[token].[ext]`
     *   - token: string - UUID identifying this staged file
     *   - mime:  string - Determined MIME type
     *   - size:  long   - File size in bytes
     */
    class Stage(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val path = parameters["path"] as? String
                ?: return BridgeResponse.error("INVALID_PARAMETERS", "path is required")

            val callerMime = parameters["mime"] as? String

            Log.d("NativeMedia.Stage", "📥 Staging file: $path (mime hint=$callerMime)")

            val source = File(path)
            if (!source.exists() || !source.isFile) {
                Log.e("NativeMedia.Stage", "❌ Source file does not exist: $path")
                return BridgeResponse.error("FILE_NOT_FOUND", "Source file does not exist: $path")
            }
            if (!source.canRead()) {
                Log.e("NativeMedia.Stage", "❌ Source file is not readable: $path")
                return BridgeResponse.error("FILE_NOT_READABLE", "Source file is not readable: $path")
            }

            try {
                val mediaDir = resolveMediaDir(activity)
                val token = UUID.randomUUID().toString()
                val ext = extensionFor(path)
                val targetName = "$token.$ext"
                val target = File(mediaDir, targetName)

                // Prefer a hard link to avoid duplicating bytes on disk. Falls back
                // to a copy if linking fails (e.g. cross-volume, source on FUSE
                // storage where hardlinks aren't permitted, or on Android < O).
                val linked = tryHardLink(source, target)
                if (!linked) {
                    Log.d("NativeMedia.Stage", "↪️ Hardlink failed, falling back to copy for $targetName")
                    copyFile(source, target)
                }

                val mime = callerMime?.takeIf { it.isNotBlank() } ?: mimeFor(ext)
                val size = target.length()
                val url = "/_assets/$MEDIA_SUBDIR/$targetName"

                Log.d(
                    "NativeMedia.Stage",
                    "✅ Staged → url=$url size=$size mime=$mime (linked=$linked)"
                )

                return BridgeResponse.success(
                    mapOf(
                        "url" to url,
                        "token" to token,
                        "mime" to mime,
                        "size" to size
                    )
                )
            } catch (e: BridgeError) {
                Log.e("NativeMedia.Stage", "❌ Bridge error: ${e.message}", e)
                return BridgeResponse.error(e)
            } catch (e: Exception) {
                Log.e("NativeMedia.Stage", "❌ Staging failed: ${e.message}", e)
                return BridgeResponse.error(
                    "STAGE_FAILED",
                    "Failed to stage file: ${e.message ?: "unknown error"}"
                )
            }
        }

        private fun tryHardLink(source: File, target: File): Boolean {
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Files.createLink(target.toPath(), source.toPath())
                    true
                } else {
                    false
                }
            } catch (e: Exception) {
                // UnsupportedOperationException, FileSystemException, EXDEV cross-device, etc.
                Log.d("NativeMedia.Stage", "ℹ️ createLink unavailable: ${e.message}")
                false
            }
        }

        private fun copyFile(source: File, target: File) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Files.copy(
                    source.toPath(),
                    target.toPath(),
                    StandardCopyOption.REPLACE_EXISTING
                )
            } else {
                source.inputStream().use { input ->
                    target.outputStream().use { output ->
                        input.copyTo(output, bufferSize = 1024 * 1024)
                    }
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Thumbnail
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate a JPEG thumbnail for an image or video, returned inline as a
     * base64 data URL (small enough to ride the bridge response safely).
     *
     * Parameters:
     *   - path:        (required) string - Absolute local file path
     *   - maxSize:     (optional) int    - Longest edge in pixels (default 512)
     *   - timeSeconds: (optional) double - Video frame timestamp (default 0.1s)
     *
     * Returns:
     *   - dataUrl: string - `data:image/jpeg;base64,...`
     *   - width:   int    - Output width
     *   - height:  int    - Output height
     *   - mime:    string - Always `image/jpeg`
     */
    class Thumbnail(private val activity: FragmentActivity) : BridgeFunction {

        companion object {
            private const val JPEG_QUALITY = 70
            private const val DEFAULT_MAX_SIZE = 512
            private const val DEFAULT_TIME_SECONDS = 0.1
        }

        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val path = parameters["path"] as? String
                ?: return BridgeResponse.error("INVALID_PARAMETERS", "path is required")

            val maxSize = (parameters["maxSize"] as? Number)?.toInt()?.coerceAtLeast(16)
                ?: DEFAULT_MAX_SIZE
            val timeSeconds = (parameters["timeSeconds"] as? Number)?.toDouble()?.coerceAtLeast(0.0)
                ?: DEFAULT_TIME_SECONDS

            Log.d(
                "NativeMedia.Thumbnail",
                "🖼️ Generating thumbnail: path=$path maxSize=$maxSize timeSeconds=$timeSeconds"
            )

            val source = File(path)
            if (!source.exists() || !source.isFile) {
                Log.e("NativeMedia.Thumbnail", "❌ Source file does not exist: $path")
                return BridgeResponse.error("FILE_NOT_FOUND", "Source file does not exist: $path")
            }
            if (!source.canRead()) {
                Log.e("NativeMedia.Thumbnail", "❌ Source file is not readable: $path")
                return BridgeResponse.error("FILE_NOT_READABLE", "Source file is not readable: $path")
            }

            val ext = extensionFor(path)

            return try {
                val bitmap: Bitmap = when {
                    isVideoExtension(ext) -> decodeVideoFrame(path, maxSize, timeSeconds)
                    isImageExtension(ext) -> decodeImageThumbnail(path, maxSize)
                    else -> {
                        Log.w(
                            "NativeMedia.Thumbnail",
                            "⚠️ Unknown extension '$ext' — attempting image decode first, video fallback after"
                        )
                        try {
                            decodeImageThumbnail(path, maxSize)
                        } catch (e: Exception) {
                            decodeVideoFrame(path, maxSize, timeSeconds)
                        }
                    }
                }

                val width = bitmap.width
                val height = bitmap.height

                val baos = ByteArrayOutputStream()
                try {
                    if (!bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos)) {
                        throw IllegalStateException("Bitmap.compress returned false")
                    }
                } finally {
                    if (!bitmap.isRecycled) {
                        bitmap.recycle()
                    }
                }

                val bytes = baos.toByteArray()
                val encoded = Base64.encodeToString(bytes, Base64.NO_WRAP)
                val dataUrl = "data:image/jpeg;base64,$encoded"

                Log.d(
                    "NativeMedia.Thumbnail",
                    "✅ Thumbnail ready: ${width}x$height bytes=${bytes.size}"
                )

                BridgeResponse.success(
                    mapOf(
                        "dataUrl" to dataUrl,
                        "width" to width,
                        "height" to height,
                        "mime" to "image/jpeg"
                    )
                )
            } catch (e: Exception) {
                Log.e("NativeMedia.Thumbnail", "❌ Thumbnail generation failed: ${e.message}", e)
                BridgeResponse.error(
                    "THUMBNAIL_FAILED",
                    "Failed to generate thumbnail: ${e.message ?: "unknown error"}"
                )
            }
        }

        /**
         * Decode a downsampled JPEG/PNG/etc thumbnail. Uses inSampleSize for
         * an efficient first-pass downsample, then a precise createScaledBitmap
         * to honour `maxSize` exactly along the longest edge.
         */
        private fun decodeImageThumbnail(path: String, maxSize: Int): Bitmap {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(path, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                throw IllegalStateException("Unable to read image bounds for $path")
            }

            val decodeOpts = BitmapFactory.Options().apply {
                inSampleSize = computeSampleSize(bounds.outWidth, bounds.outHeight, maxSize)
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }

            val decoded = BitmapFactory.decodeFile(path, decodeOpts)
                ?: throw IllegalStateException("BitmapFactory.decodeFile returned null for $path")

            return scaleToMaxEdge(decoded, maxSize, recycleSource = true)
        }

        /**
         * Decode a video frame at `timeSeconds` and scale to `maxSize` along
         * the longest edge. Uses MediaMetadataRetriever.getScaledFrameAtTime
         * on API 27+ (avoids decoding the full frame into memory).
         */
        private fun decodeVideoFrame(path: String, maxSize: Int, timeSeconds: Double): Bitmap {
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(path)
                val timeUs = (timeSeconds * 1_000_000).toLong()

                val raw: Bitmap? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    retriever.getScaledFrameAtTime(
                        timeUs,
                        MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
                        maxSize,
                        maxSize
                    )
                } else {
                    retriever.getFrameAtTime(
                        timeUs,
                        MediaMetadataRetriever.OPTION_CLOSEST_SYNC
                    )
                }

                val frame = raw ?: throw IllegalStateException(
                    "MediaMetadataRetriever returned no frame for $path at ${timeUs}us"
                )

                // getScaledFrameAtTime already returns ≤ maxSize on each edge, but
                // we still normalise via scaleToMaxEdge so the longest edge is
                // EXACTLY maxSize when possible. For the API < 27 fallback this
                // is essential.
                return scaleToMaxEdge(frame, maxSize, recycleSource = true)
            } finally {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        retriever.close()
                    } else {
                        retriever.release()
                    }
                } catch (e: Exception) {
                    Log.w("NativeMedia.Thumbnail", "⚠️ Retriever release failed: ${e.message}")
                }
            }
        }

        private fun computeSampleSize(width: Int, height: Int, maxSize: Int): Int {
            var sample = 1
            var halfW = width / 2
            var halfH = height / 2
            while ((halfW / sample) >= maxSize && (halfH / sample) >= maxSize) {
                sample *= 2
            }
            return sample.coerceAtLeast(1)
        }

        /**
         * Scale a bitmap so its longest edge equals `maxSize` (preserving
         * aspect ratio). If the bitmap is already smaller than `maxSize`, it's
         * returned unchanged.
         */
        private fun scaleToMaxEdge(source: Bitmap, maxSize: Int, recycleSource: Boolean): Bitmap {
            val srcW = source.width
            val srcH = source.height
            val longest = maxOf(srcW, srcH)
            if (longest <= maxSize) {
                return source
            }
            val scale = maxSize.toFloat() / longest.toFloat()
            val targetW = (srcW * scale).toInt().coerceAtLeast(1)
            val targetH = (srcH * scale).toInt().coerceAtLeast(1)

            val scaled = Bitmap.createScaledBitmap(source, targetW, targetH, true)
            if (recycleSource && scaled !== source && !source.isRecycled) {
                source.recycle()
            }
            return scaled
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Release
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Delete a previously staged file (and any sibling with the same token
     * prefix, in case the extension drifted).
     *
     * Parameters:
     *   - token: (required) string - Token returned by Stage
     *
     * Returns: (empty map)
     */
    class Release(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val token = parameters["token"] as? String
                ?: return BridgeResponse.error("INVALID_PARAMETERS", "token is required")

            if (token.isBlank() || token.contains('/') || token.contains('\\') || token.contains("..")) {
                return BridgeResponse.error("INVALID_PARAMETERS", "token is malformed")
            }

            Log.d("NativeMedia.Release", "🗑️ Releasing token: $token")

            try {
                val mediaDir = File(resolvePublicPath(activity), MEDIA_SUBDIR)
                if (!mediaDir.exists() || !mediaDir.isDirectory) {
                    Log.d("NativeMedia.Release", "ℹ️ Media dir does not exist — nothing to release")
                    return BridgeResponse.success(emptyMap())
                }

                val prefix = "$token."
                val matches = mediaDir.listFiles { _, name -> name.startsWith(prefix) }
                    ?: emptyArray()

                var deleted = 0
                for (file in matches) {
                    if (file.delete()) {
                        deleted++
                        Log.d("NativeMedia.Release", "✅ Deleted ${file.name}")
                    } else {
                        Log.w("NativeMedia.Release", "⚠️ Failed to delete ${file.name}")
                    }
                }

                if (deleted == 0) {
                    Log.d("NativeMedia.Release", "ℹ️ No files matched token prefix '$prefix'")
                }
            } catch (e: Exception) {
                // Per spec: silently ignore missing — but log unexpected errors so
                // they don't go unnoticed in development.
                Log.w("NativeMedia.Release", "⚠️ Release encountered an error: ${e.message}", e)
            }

            return BridgeResponse.success(emptyMap())
        }
    }
}
