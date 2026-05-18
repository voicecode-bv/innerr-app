import Foundation
import UIKit
import AVFoundation
import UniformTypeIdentifiers

// MARK: - NativeMedia Function Namespace

/// Functions related to staging local media files for direct WebView consumption
/// and generating thumbnails for images/videos.
///
/// The NativePHP iOS `PHPSchemeHandler` corrupts binary bytes when forwarding
/// requests through PHP (UTF-8 string roundtrip), so videos cannot be served
/// via the normal php:// route. However, the scheme handler has a fast path
/// for `/_assets/...` URLs that serves files directly from
/// `Documents/app/public/...` with proper range-request, streaming and
/// Content-Type support — bypassing PHP entirely.
///
/// This plugin stages files under `Documents/app/public/_media/<token>.<ext>`
/// and returns relative URLs of the form `/_assets/_media/<token>.<ext>` that
/// the WebView can use directly in `<video src>` / `<img src>` attributes.
///
/// Namespace: "NativeMedia.*"
enum NativeMediaFunctions {

    // MARK: - Shared Helpers

    /// Returns the absolute path to the staging directory
    /// (`Documents/app/public/_media`). Creates it if missing.
    fileprivate static func resolveMediaDirectory() throws -> String {
        let appPath = AppUpdateManager.shared.getAppPath()
        let publicPath = appPath + "/public"
        let mediaPath = publicPath + "/_media"

        let fm = FileManager.default

        // Ensure the public root exists (it should, but be defensive).
        if !fm.fileExists(atPath: publicPath) {
            try fm.createDirectory(atPath: publicPath, withIntermediateDirectories: true)
        }

        if !fm.fileExists(atPath: mediaPath) {
            try fm.createDirectory(atPath: mediaPath, withIntermediateDirectories: true)
        }

        return mediaPath
    }

    /// Best-effort MIME lookup from a file extension. Mirrors what the
    /// PHPSchemeHandler's `guessMimeType` knows, plus common video/image types
    /// so callers always get something useful back.
    fileprivate static func mimeType(forExtension ext: String) -> String {
        switch ext.lowercased() {
        case "jpg", "jpeg":
            return "image/jpeg"
        case "png":
            return "image/png"
        case "gif":
            return "image/gif"
        case "webp":
            return "image/webp"
        case "heic":
            return "image/heic"
        case "heif":
            return "image/heif"
        case "svg":
            return "image/svg+xml"
        case "bmp":
            return "image/bmp"
        case "mp4":
            return "video/mp4"
        case "m4v":
            return "video/x-m4v"
        case "mov":
            return "video/quicktime"
        case "webm":
            return "video/webm"
        case "avi":
            return "video/avi"
        case "mkv":
            return "video/x-matroska"
        case "m4a":
            return "audio/mp4"
        case "mp3":
            return "audio/mpeg"
        case "wav":
            return "audio/wav"
        default:
            return "application/octet-stream"
        }
    }

    /// Inverse lookup: given a MIME type, return the most appropriate file
    /// extension (without leading dot). Used when the source file has no
    /// extension but the caller supplied a MIME hint.
    fileprivate static func fileExtension(forMime mime: String) -> String? {
        let lower = mime.lowercased()
        switch lower {
        case "image/jpeg", "image/jpg":
            return "jpg"
        case "image/png":
            return "png"
        case "image/gif":
            return "gif"
        case "image/webp":
            return "webp"
        case "image/heic":
            return "heic"
        case "image/heif":
            return "heif"
        case "image/svg+xml":
            return "svg"
        case "image/bmp":
            return "bmp"
        case "video/mp4":
            return "mp4"
        case "video/x-m4v":
            return "m4v"
        case "video/quicktime":
            return "mov"
        case "video/webm":
            return "webm"
        case "video/avi", "video/x-msvideo":
            return "avi"
        case "video/x-matroska":
            return "mkv"
        case "audio/mp4":
            return "m4a"
        case "audio/mpeg":
            return "mp3"
        case "audio/wav", "audio/x-wav":
            return "wav"
        default:
            // Fall back to UTType lookup for anything else.
            if let utType = UTType(mimeType: lower) {
                return utType.preferredFilenameExtension
            }
            return nil
        }
    }

    /// Returns true if the given extension is a video format.
    fileprivate static func isVideoExtension(_ ext: String) -> Bool {
        switch ext.lowercased() {
        case "mov", "mp4", "m4v", "webm", "avi", "mkv", "3gp", "3g2":
            return true
        default:
            return false
        }
    }

    /// Returns true if the given extension is an image format.
    fileprivate static func isImageExtension(_ ext: String) -> Bool {
        switch ext.lowercased() {
        case "jpg", "jpeg", "png", "heic", "heif", "gif", "webp", "bmp", "tiff", "tif":
            return true
        default:
            return false
        }
    }

    // MARK: - NativeMedia.Stage

    /// Stage a local media file under the WebView-serveable assets directory.
    /// Parameters:
    ///   - path: (required) string - Absolute local file path
    ///   - mime: (optional) string - Caller-supplied MIME hint; if omitted, derived from extension
    /// Returns:
    ///   - url: string - Relative URL like `/_assets/_media/<token>.<ext>` usable in `<video src>` / `<img src>`
    ///   - token: string - Opaque UUID token; pass back to `NativeMedia.Release` to delete the staged copy
    ///   - mime: string - The resolved MIME type for the file
    ///   - size: int - File size in bytes
    class Stage: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let sourcePath = parameters["path"] as? String, !sourcePath.isEmpty else {
                throw NSError(domain: "NativeMedia",
                              code: 400,
                              userInfo: [NSLocalizedDescriptionKey: "path is required"])
            }

            let mimeHint = parameters["mime"] as? String

            print("🎞️ NativeMedia.Stage path=\(sourcePath) mimeHint=\(mimeHint ?? "nil")")

            let fm = FileManager.default

            guard fm.fileExists(atPath: sourcePath) else {
                throw NSError(domain: "NativeMedia",
                              code: 404,
                              userInfo: [NSLocalizedDescriptionKey: "Source file does not exist: \(sourcePath)"])
            }

            // Determine the extension. Prefer the source path's extension; if
            // missing, derive from the MIME hint; finally fall back to "bin".
            let sourceURL = URL(fileURLWithPath: sourcePath)
            var ext = sourceURL.pathExtension.lowercased()
            if ext.isEmpty {
                if let hint = mimeHint, let derived = NativeMediaFunctions.fileExtension(forMime: hint) {
                    ext = derived
                } else {
                    ext = "bin"
                }
            }

            // Resolve final MIME: use caller hint if provided, else from extension.
            let resolvedMime: String
            if let hint = mimeHint, !hint.isEmpty {
                resolvedMime = hint
            } else {
                resolvedMime = NativeMediaFunctions.mimeType(forExtension: ext)
            }

            // Stage destination.
            let mediaDir: String
            do {
                mediaDir = try NativeMediaFunctions.resolveMediaDirectory()
            } catch {
                throw NSError(domain: "NativeMedia",
                              code: 500,
                              userInfo: [NSLocalizedDescriptionKey: "Failed to resolve media staging directory: \(error.localizedDescription)"])
            }

            let token = UUID().uuidString.lowercased()
            let destFilename = "\(token).\(ext)"
            let destPath = mediaDir + "/" + destFilename

            // Defensive: very unlikely UUID collision, but if a file is already
            // there from a previous run, blow it away.
            if fm.fileExists(atPath: destPath) {
                try? fm.removeItem(atPath: destPath)
            }

            // Try a hard link first — it's instant and uses no extra disk space
            // when source/dest are on the same volume. Fall back to a copy if
            // linkItem fails (e.g. cross-volume, source not readable in-place).
            var didLink = false
            do {
                try fm.linkItem(atPath: sourcePath, toPath: destPath)
                didLink = true
                print("🔗 Hard-linked \(sourcePath) -> \(destPath)")
            } catch {
                print("⚠️ linkItem failed (\(error.localizedDescription)); falling back to copyItem")
                do {
                    try fm.copyItem(atPath: sourcePath, toPath: destPath)
                    print("📄 Copied \(sourcePath) -> \(destPath)")
                } catch {
                    throw NSError(domain: "NativeMedia",
                                  code: 500,
                                  userInfo: [NSLocalizedDescriptionKey: "Failed to stage media file: \(error.localizedDescription)"])
                }
            }

            // Exclude from iCloud / iTunes backup — these are ephemeral staged
            // copies of user media.
            var destURL = URL(fileURLWithPath: destPath)
            var resourceValues = URLResourceValues()
            resourceValues.isExcludedFromBackup = true
            try? destURL.setResourceValues(resourceValues)

            // Resolve final size from the staged file.
            var size: Int = 0
            if let attributes = try? fm.attributesOfItem(atPath: destPath),
               let fileSize = attributes[.size] as? NSNumber {
                size = fileSize.intValue
            }

            let relativeUrl = "/_assets/_media/" + destFilename

            print("✅ Staged media token=\(token) url=\(relativeUrl) size=\(size) link=\(didLink)")

            return [
                "url": relativeUrl,
                "token": token,
                "mime": resolvedMime,
                "size": size,
            ]
        }
    }

    // MARK: - NativeMedia.Thumbnail

    /// Generate a thumbnail (JPEG data URL) for a local image or video file.
    /// Parameters:
    ///   - path: (required) string - Absolute local file path (image or video)
    ///   - maxSize: (optional) int - Longest edge of the output JPEG in pixels (default: 512)
    ///   - timeSeconds: (optional) double - For videos: timestamp to grab the frame from (default: 0.1)
    /// Returns:
    ///   - dataUrl: string - `data:image/jpeg;base64,...` ready to assign to `<img src>`
    ///   - width: int - Output width in pixels
    ///   - height: int - Output height in pixels
    ///   - mime: string - Always `image/jpeg`
    class Thumbnail: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let sourcePath = parameters["path"] as? String, !sourcePath.isEmpty else {
                throw NSError(domain: "NativeMedia",
                              code: 400,
                              userInfo: [NSLocalizedDescriptionKey: "path is required"])
            }

            // maxSize accepts Int, NSNumber, or String for robustness across bridge types.
            let maxSize: Int
            if let intVal = parameters["maxSize"] as? Int {
                maxSize = intVal > 0 ? intVal : 512
            } else if let numVal = parameters["maxSize"] as? NSNumber {
                let v = numVal.intValue
                maxSize = v > 0 ? v : 512
            } else if let strVal = parameters["maxSize"] as? String, let v = Int(strVal), v > 0 {
                maxSize = v
            } else {
                maxSize = 512
            }

            let timeSeconds: Double
            if let dblVal = parameters["timeSeconds"] as? Double {
                timeSeconds = dblVal >= 0 ? dblVal : 0.1
            } else if let numVal = parameters["timeSeconds"] as? NSNumber {
                let v = numVal.doubleValue
                timeSeconds = v >= 0 ? v : 0.1
            } else if let strVal = parameters["timeSeconds"] as? String, let v = Double(strVal), v >= 0 {
                timeSeconds = v
            } else {
                timeSeconds = 0.1
            }

            print("🖼️ NativeMedia.Thumbnail path=\(sourcePath) maxSize=\(maxSize) timeSeconds=\(timeSeconds)")

            let fm = FileManager.default
            guard fm.fileExists(atPath: sourcePath) else {
                throw NSError(domain: "NativeMedia",
                              code: 404,
                              userInfo: [NSLocalizedDescriptionKey: "Source file does not exist: \(sourcePath)"])
            }

            let sourceURL = URL(fileURLWithPath: sourcePath)
            let ext = sourceURL.pathExtension.lowercased()

            // Decide which kind of media we're dealing with. Prefer the
            // extension check (it's fast and unambiguous for the common cases),
            // and fall back to a UTType lookup if the extension is missing or
            // unrecognised.
            var treatAsVideo = NativeMediaFunctions.isVideoExtension(ext)
            var treatAsImage = NativeMediaFunctions.isImageExtension(ext)

            if !treatAsVideo && !treatAsImage {
                if let utType = UTType(filenameExtension: ext) {
                    if utType.conforms(to: .movie) || utType.conforms(to: .video) {
                        treatAsVideo = true
                    } else if utType.conforms(to: .image) {
                        treatAsImage = true
                    }
                }
            }

            if !treatAsVideo && !treatAsImage {
                throw NSError(domain: "NativeMedia",
                              code: 415,
                              userInfo: [NSLocalizedDescriptionKey: "Unsupported media type for thumbnail: .\(ext)"])
            }

            // Load source as a UIImage (either an image file or an extracted video frame).
            let sourceImage: UIImage
            if treatAsVideo {
                sourceImage = try NativeMediaFunctions.extractVideoFrame(at: sourceURL, timeSeconds: timeSeconds)
            } else {
                guard let img = UIImage(contentsOfFile: sourcePath) else {
                    throw NSError(domain: "NativeMedia",
                                  code: 500,
                                  userInfo: [NSLocalizedDescriptionKey: "Failed to load image at \(sourcePath)"])
                }
                sourceImage = img
            }

            // Resize, preserving aspect ratio, so the longest edge ≤ maxSize.
            let resized = NativeMediaFunctions.resize(image: sourceImage, longestEdge: CGFloat(maxSize))

            // JPEG encode at quality 0.7.
            guard let jpegData = resized.jpegData(compressionQuality: 0.7) else {
                throw NSError(domain: "NativeMedia",
                              code: 500,
                              userInfo: [NSLocalizedDescriptionKey: "Failed to encode thumbnail as JPEG"])
            }

            let base64 = jpegData.base64EncodedString()
            let dataUrl = "data:image/jpeg;base64,\(base64)"

            let width = Int(resized.size.width * resized.scale)
            let height = Int(resized.size.height * resized.scale)

            print("✅ Thumbnail generated width=\(width) height=\(height) bytes=\(jpegData.count)")

            return [
                "dataUrl": dataUrl,
                "width": width,
                "height": height,
                "mime": "image/jpeg",
            ]
        }
    }

    /// Extract a single frame from a video file at the given timestamp.
    fileprivate static func extractVideoFrame(at url: URL, timeSeconds: Double) throws -> UIImage {
        let asset = AVURLAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        // Allow generator some slack so it can return a frame even if the exact
        // requested timestamp doesn't land on a keyframe. 0.5s in either
        // direction is plenty for thumbnail purposes.
        generator.requestedTimeToleranceBefore = CMTime(seconds: 0.5, preferredTimescale: 600)
        generator.requestedTimeToleranceAfter = CMTime(seconds: 0.5, preferredTimescale: 600)

        let time = CMTime(seconds: max(0, timeSeconds), preferredTimescale: 600)
        var actualTime = CMTime.zero

        do {
            let cgImage = try generator.copyCGImage(at: time, actualTime: &actualTime)
            return UIImage(cgImage: cgImage)
        } catch {
            // Some videos can't produce a frame at the very start — retry once at time zero.
            if timeSeconds > 0 {
                let fallback = CMTime.zero
                do {
                    let cgImage = try generator.copyCGImage(at: fallback, actualTime: &actualTime)
                    return UIImage(cgImage: cgImage)
                } catch {
                    throw NSError(domain: "NativeMedia",
                                  code: 500,
                                  userInfo: [NSLocalizedDescriptionKey: "Failed to extract video frame: \(error.localizedDescription)"])
                }
            }
            throw NSError(domain: "NativeMedia",
                          code: 500,
                          userInfo: [NSLocalizedDescriptionKey: "Failed to extract video frame: \(error.localizedDescription)"])
        }
    }

    /// Resize an image so the longest edge is at most `longestEdge` points
    /// (in points, with scale 1 so the pixel dimensions match what we return).
    fileprivate static func resize(image: UIImage, longestEdge: CGFloat) -> UIImage {
        // Work in pixels by collapsing scale into the size.
        let pixelWidth = image.size.width * image.scale
        let pixelHeight = image.size.height * image.scale
        let currentLongest = max(pixelWidth, pixelHeight)

        // No need to resize if already small enough.
        if currentLongest <= longestEdge {
            // Re-render at scale 1 so the JPEG/byte size accounting is correct
            // and the returned width/height match the actual pixel data.
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            format.opaque = true
            let pixelSize = CGSize(width: pixelWidth, height: pixelHeight)
            let renderer = UIGraphicsImageRenderer(size: pixelSize, format: format)
            return renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: pixelSize))
            }
        }

        let ratio = longestEdge / currentLongest
        let newWidth = floor(pixelWidth * ratio)
        let newHeight = floor(pixelHeight * ratio)
        let newSize = CGSize(width: newWidth, height: newHeight)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)

        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }

    // MARK: - NativeMedia.Release

    /// Release a previously staged media file. Deletes any file under
    /// `Documents/app/public/_media/` whose name starts with `<token>.`.
    /// Parameters:
    ///   - token: (required) string - The token returned by `NativeMedia.Stage`
    /// Returns:
    ///   - (empty map)
    class Release: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let token = parameters["token"] as? String, !token.isEmpty else {
                throw NSError(domain: "NativeMedia",
                              code: 400,
                              userInfo: [NSLocalizedDescriptionKey: "token is required"])
            }

            print("🗑️ NativeMedia.Release token=\(token)")

            let mediaDir: String
            do {
                mediaDir = try NativeMediaFunctions.resolveMediaDirectory()
            } catch {
                // If we can't even resolve the directory there's nothing to delete.
                print("⚠️ Release: media dir unavailable (\(error.localizedDescription)); nothing to do")
                return [:]
            }

            let fm = FileManager.default
            let prefix = token + "."

            guard let entries = try? fm.contentsOfDirectory(atPath: mediaDir) else {
                print("⚠️ Release: could not list media dir; nothing to do")
                return [:]
            }

            var deleted = 0
            for entry in entries where entry.hasPrefix(prefix) {
                let fullPath = mediaDir + "/" + entry
                do {
                    try fm.removeItem(atPath: fullPath)
                    deleted += 1
                    print("🗑️ Deleted staged file: \(entry)")
                } catch {
                    // Silently ignore — file may have already been swept up.
                    print("⚠️ Failed to delete \(entry): \(error.localizedDescription)")
                }
            }

            if deleted == 0 {
                print("ℹ️ Release: no staged files matched token=\(token)")
            }

            return [:]
        }
    }
}
