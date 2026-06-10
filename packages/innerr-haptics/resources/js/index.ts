/**
 * innerr/haptics — JS bridge for the Haptics plugin.
 *
 * Exposes the platform feedback generators (UIImpactFeedbackGenerator etc. on
 * iOS, predefined VibrationEffects on Android) instead of the full-device
 * vibrate that the core `Device.Vibrate` bridge function plays.
 *
 * Calls are fire-and-forget on the native side; rejections only occur when the
 * bridge itself is unavailable. App code should use the wrapper in
 * `resources/js/spa/utils/haptics.ts`, which swallows those.
 */
import { BridgeCall } from '@nativephp/mobile';

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
export type NotificationType = 'success' | 'warning' | 'error';

/**
 * Play a physical impact haptic. `intensity` (0-1) only has effect on iOS.
 */
export async function impact(
    style: ImpactStyle = 'light',
    intensity?: number,
): Promise<void> {
    const params: { style: ImpactStyle; intensity?: number } = { style };

    if (intensity !== undefined) {
        params.intensity = intensity;
    }

    await BridgeCall('Haptics.Impact', params);
}

/**
 * Play a notification haptic (distinct success/warning/error patterns).
 */
export async function notification(
    type: NotificationType = 'success',
): Promise<void> {
    await BridgeCall('Haptics.Notification', { type });
}

/**
 * Play the subtle selection-changed tick (picker/segment style feedback).
 */
export async function selection(): Promise<void> {
    await BridgeCall('Haptics.Selection', {});
}

export const Haptics = {
    impact,
    notification,
    selection,
};

export default Haptics;
