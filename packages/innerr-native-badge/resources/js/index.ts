/**
 * innerr/native-badge — JS bridge for the NativeBadge plugin.
 *
 * Sets the app icon badge counter (the number on the app icon). iOS normally
 * derives this from the `aps.badge` field of an incoming push, but it does not
 * decrement the badge when the user reads notifications in-app — so the app
 * calls `setBadge()` to keep it in sync.
 *
 * On iOS this sets an exact number. On Android setting an arbitrary count is
 * launcher-dependent, so only clearing (count 0) is reliable there.
 */
import { BridgeCall } from '@nativephp/mobile';

/**
 * Set the app icon badge counter. Pass 0 to clear it. Negative or fractional
 * values are normalised to a non-negative integer.
 *
 * Safe to call on web/desktop where the native bridge is absent — the
 * underlying bridge call simply rejects, so callers should ignore failures.
 */
export async function setBadge(count: number): Promise<void> {
    await BridgeCall('Badge.Set', { count: Math.max(0, Math.trunc(count || 0)) });
}

export const NativeBadge = {
    setBadge,
};

export default NativeBadge;
