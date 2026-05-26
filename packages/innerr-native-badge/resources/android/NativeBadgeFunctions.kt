package app.innerr.nativebadge

import android.app.NotificationManager
import android.content.Context
import android.util.Log
import androidx.fragment.app.FragmentActivity
import com.nativephp.mobile.bridge.BridgeFunction
import com.nativephp.mobile.bridge.BridgeResponse

/**
 * Functions for controlling the app icon badge counter.
 *
 * Android numeric app-icon badges are launcher-dependent and there is no
 * reliable launcher-agnostic API to set an arbitrary count from the app.
 * We therefore only handle the "clear" case (count <= 0) by cancelling all
 * notifications; for a positive count we leave the launcher's
 * notification-driven badge untouched (the count rides along on the FCM
 * payload via `notification_count`, which supporting launchers honour).
 *
 * Namespace: "Badge.*"
 */
object NativeBadgeFunctions {

    /**
     * Set the app icon badge counter.
     *
     * Parameters:
     *   - count: (required) int - The badge number. 0 (or less) clears the badge.
     *
     * Returns:
     *   - success: bool
     */
    class Set(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val count = (parameters["count"] as? Number)?.toInt()
                ?: (parameters["count"] as? String)?.toIntOrNull()
                ?: return BridgeResponse.error("INVALID_PARAMETERS", "count is required")

            Log.d("Badge.Set", "Setting badge to $count")

            if (count <= 0) {
                val manager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.cancelAll()
            }
            // count > 0: no reliable launcher-agnostic API to set a number;
            // rely on the FCM push payload's notification_count instead.

            return BridgeResponse.success(mapOf("success" to true))
        }
    }
}
