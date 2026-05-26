import Foundation
import UserNotifications

// MARK: - NativeBadge Function Namespace

/// Functions for controlling the app icon badge counter (the red number on the
/// app icon).
///
/// iOS normally sets this badge automatically from the `aps.badge` field of an
/// incoming push payload. This plugin lets the app set the badge explicitly so
/// it can stay in sync when the user reads notifications in-app (iOS does not
/// decrement the badge on its own).
///
/// Namespace: "Badge.*"
enum NativeBadgeFunctions {

    // MARK: - Badge.Set

    /// Set the app icon badge counter to a specific number.
    /// Parameters:
    ///   - count: (required) int - The badge number to display. 0 clears the badge.
    /// Returns:
    ///   - success: bool
    class Set: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            // Accept Int, NSNumber or String for robustness across bridge types.
            let count: Int
            if let intVal = parameters["count"] as? Int {
                count = max(0, intVal)
            } else if let numVal = parameters["count"] as? NSNumber {
                count = max(0, numVal.intValue)
            } else if let strVal = parameters["count"] as? String, let parsed = Int(strVal) {
                count = max(0, parsed)
            } else {
                throw NSError(domain: "NativeBadge",
                              code: 400,
                              userInfo: [NSLocalizedDescriptionKey: "count is required"])
            }

            print("🔴 Badge.Set count=\(count)")

            DispatchQueue.main.async {
                UNUserNotificationCenter.current().setBadgeCount(count)
            }

            return ["success": true]
        }
    }
}
