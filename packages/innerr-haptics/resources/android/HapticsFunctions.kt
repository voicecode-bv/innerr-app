package app.innerr.haptics

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.fragment.app.FragmentActivity
import com.nativephp.mobile.bridge.BridgeFunction
import com.nativephp.mobile.bridge.BridgeResponse

/**
 * UI haptic feedback mirroring the iOS UIKit feedback generators.
 *
 * Uses predefined [VibrationEffect]s on API 29+ (which route through the
 * device's haptic compositor for crisp clicks) and falls back to short
 * amplitude-controlled one-shots on API 26-28. Haptics are best-effort: when
 * the device lacks a vibrator or the user disabled touch feedback we silently
 * succeed.
 *
 * Namespace: "Haptics.*"
 */
object HapticsFunctions {

    private fun resolveVibrator(context: Context): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager =
                context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }?.takeIf { it.hasVibrator() }
    }

    /**
     * Predefined effects need API 29; below that we approximate the same feel
     * with a short one-shot at the given amplitude.
     */
    private fun playPredefined(
        vibrator: Vibrator,
        predefinedId: Int,
        fallbackMillis: Long,
        fallbackAmplitude: Int,
    ) {
        val effect = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            VibrationEffect.createPredefined(predefinedId)
        } else {
            VibrationEffect.createOneShot(fallbackMillis, fallbackAmplitude)
        }
        vibrator.vibrate(effect)
    }

    class Impact(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val vibrator = resolveVibrator(activity)
                ?: return BridgeResponse.success(mapOf("success" to true))

            when ((parameters["style"] as? String ?: "light").lowercase()) {
                "heavy", "rigid" -> playPredefined(
                    vibrator,
                    VibrationEffect.EFFECT_HEAVY_CLICK,
                    fallbackMillis = 30,
                    fallbackAmplitude = 255,
                )

                "medium" -> playPredefined(
                    vibrator,
                    VibrationEffect.EFFECT_CLICK,
                    fallbackMillis = 20,
                    fallbackAmplitude = 160,
                )

                else -> playPredefined(
                    vibrator,
                    VibrationEffect.EFFECT_TICK,
                    fallbackMillis = 10,
                    fallbackAmplitude = 80,
                )
            }

            return BridgeResponse.success(mapOf("success" to true))
        }
    }

    class Notification(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val vibrator = resolveVibrator(activity)
                ?: return BridgeResponse.success(mapOf("success" to true))

            // Approximate the iOS notification haptics with short waveforms:
            // success = two quick light taps, warning = tap-pause-tap,
            // error = three sharp taps.
            val (timings, amplitudes) = when (
                (parameters["type"] as? String ?: "success").lowercase()
            ) {
                "warning" -> longArrayOf(0, 20, 100, 30) to intArrayOf(0, 140, 0, 200)
                "error" -> longArrayOf(0, 25, 70, 25, 70, 35) to
                    intArrayOf(0, 200, 0, 200, 0, 255)

                else -> longArrayOf(0, 15, 60, 25) to intArrayOf(0, 120, 0, 180)
            }

            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))

            return BridgeResponse.success(mapOf("success" to true))
        }
    }

    class Selection(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val vibrator = resolveVibrator(activity)
                ?: return BridgeResponse.success(mapOf("success" to true))

            playPredefined(
                vibrator,
                VibrationEffect.EFFECT_TICK,
                fallbackMillis = 8,
                fallbackAmplitude = 60,
            )

            return BridgeResponse.success(mapOf("success" to true))
        }
    }
}
