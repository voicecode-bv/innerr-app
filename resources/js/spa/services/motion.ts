/**
 * Shared motion math for gesture-driven surfaces (bottom sheets, drawer).
 *
 * Fixed-duration settles after a drag read as sluggish: a fast flick should
 * land quickly, a gentle release should glide. These helpers convert the
 * gesture's release velocity into a settle duration.
 */

const MIN_SETTLE_MS = 150;
const MAX_SETTLE_MS = 350;
const DEFAULT_SETTLE_MS = 300;

/**
 * Duration for animating `distancePx` to rest after a drag released at
 * `velocityPxPerMs` (absolute, in the direction of travel). Falls back to the
 * default when the gesture was effectively static, and is clamped so settles
 * never feel instant or sticky.
 */
export function settleDurationMs(
    distancePx: number,
    velocityPxPerMs: number,
): number {
    const distance = Math.abs(distancePx);
    const velocity = Math.abs(velocityPxPerMs);

    if (distance < 1) {
        return MIN_SETTLE_MS;
    }

    if (velocity < 0.1) {
        return DEFAULT_SETTLE_MS;
    }

    return Math.round(
        Math.min(MAX_SETTLE_MS, Math.max(MIN_SETTLE_MS, distance / velocity)),
    );
}

/**
 * Tracks pointer velocity across move events. Velocity is in px/ms; the sign
 * follows the axis direction (positive = down/right).
 */
export function createVelocityTracker() {
    let lastPosition = 0;
    let lastTime = 0;
    let velocity = 0;

    return {
        start(position: number): void {
            lastPosition = position;
            lastTime = performance.now();
            velocity = 0;
        },

        move(position: number): void {
            const now = performance.now();

            if (now > lastTime) {
                velocity = (position - lastPosition) / (now - lastTime);
            }

            lastPosition = position;
            lastTime = now;
        },

        velocity(): number {
            return velocity;
        },
    };
}

/**
 * Roll direction for an animated counter: increasing values roll up (old
 * digit exits upward, new enters from below), decreasing values roll down.
 * Non-numeric values (e.g. a "99+" badge cap) default to rolling up.
 */
export function rollDirection(
    next: number | string,
    previous: number | string,
): 'up' | 'down' {
    const nextNumber = typeof next === 'number' ? next : Number(next);
    const previousNumber =
        typeof previous === 'number' ? previous : Number(previous);

    if (Number.isNaN(nextNumber) || Number.isNaN(previousNumber)) {
        return 'up';
    }

    return nextNumber >= previousNumber ? 'up' : 'down';
}

/**
 * Whether the user asked the OS to minimize motion. Gesture-driven surfaces
 * should snap instead of animate when this is set.
 */
export function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}
