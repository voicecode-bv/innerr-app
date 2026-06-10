import Foundation
import UIKit

// MARK: - Haptics Function Namespace

/// UI haptic feedback via the dedicated UIKit feedback generators.
///
/// The core NativePHP `Device.Vibrate` plays `kSystemSoundID_Vibrate`, a full
/// ~400ms device buzz that is far too heavy for UI micro-interactions (like
/// taps, pull-to-refresh arming, sheet snaps). These functions expose the
/// proper `UIImpactFeedbackGenerator` / `UINotificationFeedbackGenerator` /
/// `UISelectionFeedbackGenerator` taps instead.
///
/// All generators must be used from the main thread; the bridge may invoke us
/// from a background queue, so each call hops to main fire-and-forget and
/// returns immediately. Haptics are best-effort by nature (the OS silently
/// drops them when unsupported or disabled), so there is no failure path.
///
/// Namespace: "Haptics.*"
enum HapticsFunctions {

    // MARK: - Haptics.Impact

    /// Play a physical impact haptic.
    /// Parameters:
    ///   - style: (optional) string - light|medium|heavy|soft|rigid (default: light)
    ///   - intensity: (optional) double - 0.0 ... 1.0 multiplier (default: full)
    /// Returns:
    ///   - success: boolean
    class Impact: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            let style: UIImpactFeedbackGenerator.FeedbackStyle
            switch (parameters["style"] as? String ?? "light").lowercased() {
            case "medium":
                style = .medium
            case "heavy":
                style = .heavy
            case "soft":
                style = .soft
            case "rigid":
                style = .rigid
            default:
                style = .light
            }

            let intensity = parameters["intensity"] as? Double

            DispatchQueue.main.async {
                let generator = UIImpactFeedbackGenerator(style: style)
                generator.prepare()
                if let intensity {
                    generator.impactOccurred(intensity: CGFloat(min(max(intensity, 0), 1)))
                } else {
                    generator.impactOccurred()
                }
            }

            return ["success": true]
        }
    }

    // MARK: - Haptics.Notification

    /// Play a notification haptic.
    /// Parameters:
    ///   - type: (optional) string - success|warning|error (default: success)
    /// Returns:
    ///   - success: boolean
    class Notification: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            let type: UINotificationFeedbackGenerator.FeedbackType
            switch (parameters["type"] as? String ?? "success").lowercased() {
            case "warning":
                type = .warning
            case "error":
                type = .error
            default:
                type = .success
            }

            DispatchQueue.main.async {
                let generator = UINotificationFeedbackGenerator()
                generator.prepare()
                generator.notificationOccurred(type)
            }

            return ["success": true]
        }
    }

    // MARK: - Haptics.Selection

    /// Play the subtle selection-changed tick.
    /// Parameters: none
    /// Returns:
    ///   - success: boolean
    class Selection: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            DispatchQueue.main.async {
                let generator = UISelectionFeedbackGenerator()
                generator.prepare()
                generator.selectionChanged()
            }

            return ["success": true]
        }
    }
}
