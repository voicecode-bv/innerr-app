import type { Directive } from 'vue';

// Pinch-to-zoom for post media (photos and videos). We keep the original
// element in place and lift a fixed-positioned copy above a dark backdrop, so
// the container's `overflow-hidden` doesn't clip the zoomed media and the
// vertical feed scroll doesn't shift. On release the copy springs back to its
// original spot (Instagram style).
//
// Photos copy cleanly via cloneNode. Videos don't (a cloned <video> restarts
// and shows a different frame), so we snapshot the current frame onto a canvas
// and lift that instead, falling back to the poster when no frame is decoded.

interface PinchState {
    clone: HTMLElement | null;
    backdrop: HTMLDivElement | null;
    startDistance: number;
    startMidX: number;
    startMidY: number;
    active: boolean;
    onTouchStart: (event: TouchEvent) => void;
    onTouchMove: (event: TouchEvent) => void;
    onTouchEnd: (event: TouchEvent) => void;
}

type PinchHost = HTMLElement & { _pinchZoom?: PinchState };

const MAX_SCALE = 4;
const RESTORE_MS = 250;

function distanceBetween(a: Touch, b: Touch): number {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export const vPinchZoom: Directive<PinchHost> = {
    mounted(el): void {
        if (typeof window === 'undefined' || !('ontouchstart' in window)) {
            return;
        }

        const state: PinchState = {
            clone: null,
            backdrop: null,
            startDistance: 0,
            startMidX: 0,
            startMidY: 0,
            active: false,
            onTouchStart: () => {},
            onTouchMove: () => {},
            onTouchEnd: () => {},
        };

        function createLiftedNode(
            rect: DOMRect,
            midX: number,
            midY: number,
        ): HTMLElement | null {
            const cssText =
                `position:fixed;top:${rect.top}px;left:${rect.left}px;` +
                `width:${rect.width}px;height:${rect.height}px;margin:0;` +
                `object-fit:${getComputedStyle(el).objectFit};z-index:9999;` +
                `transform-origin:${midX - rect.left}px ${midY - rect.top}px;` +
                'will-change:transform;pointer-events:none;';

            if (el instanceof HTMLVideoElement) {
                // Snapshot the frame the user currently sees; the original keeps
                // playing underneath while hidden.
                if (el.videoWidth > 0 && el.videoHeight > 0) {
                    const canvas = document.createElement('canvas');
                    canvas.width = el.videoWidth;
                    canvas.height = el.videoHeight;
                    const context = canvas.getContext('2d');

                    if (context) {
                        try {
                            context.drawImage(
                                el,
                                0,
                                0,
                                canvas.width,
                                canvas.height,
                            );
                            canvas.style.cssText = cssText;

                            return canvas;
                        } catch {
                            // drawImage can throw on some platforms; fall
                            // through to the poster below.
                        }
                    }
                }

                const poster = el.getAttribute('poster');

                if (poster) {
                    const image = document.createElement('img');
                    image.src = poster;
                    image.style.cssText = cssText;

                    return image;
                }

                return null;
            }

            const clone = el.cloneNode(true) as HTMLElement;
            clone.style.cssText = cssText;

            return clone;
        }

        function begin(event: TouchEvent): void {
            if (event.touches.length !== 2 || state.active) {
                return;
            }

            const [a, b] = [event.touches[0], event.touches[1]];
            const rect = el.getBoundingClientRect();
            const midX = (a.clientX + b.clientX) / 2;
            const midY = (a.clientY + b.clientY) / 2;

            const lifted = createLiftedNode(rect, midX, midY);

            // No frame and no poster yet: let the gesture fall through to a
            // normal scroll instead of flashing an empty overlay.
            if (!lifted) {
                return;
            }

            state.active = true;
            state.startDistance = distanceBetween(a, b);
            state.startMidX = midX;
            state.startMidY = midY;

            const backdrop = document.createElement('div');
            backdrop.style.cssText =
                'position:fixed;inset:0;background:#000;opacity:0;z-index:9998;touch-action:none;will-change:opacity;';
            document.body.appendChild(backdrop);
            state.backdrop = backdrop;

            document.body.appendChild(lifted);
            state.clone = lifted;

            // Hide the original so we don't see a duplicate; the active touch
            // sequence stays targeted at this element.
            el.style.visibility = 'hidden';

            event.preventDefault();
            event.stopPropagation();
        }

        function move(event: TouchEvent): void {
            if (!state.active || event.touches.length < 2) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const [a, b] = [event.touches[0], event.touches[1]];
            const scale = Math.min(
                MAX_SCALE,
                Math.max(1, distanceBetween(a, b) / state.startDistance),
            );
            const translateX = (a.clientX + b.clientX) / 2 - state.startMidX;
            const translateY = (a.clientY + b.clientY) / 2 - state.startMidY;

            if (state.clone) {
                state.clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            }

            if (state.backdrop) {
                state.backdrop.style.opacity = String(
                    Math.min(0.8, (scale - 1) * 0.5),
                );
            }
        }

        function end(event: TouchEvent): void {
            if (!state.active || event.touches.length >= 2) {
                return;
            }

            state.active = false;
            const clone = state.clone;
            const backdrop = state.backdrop;
            state.clone = null;
            state.backdrop = null;

            if (!clone) {
                backdrop?.remove();
                el.style.visibility = '';

                return;
            }

            let done = false;
            const cleanup = (): void => {
                if (done) {
                    return;
                }

                done = true;
                clone.remove();
                backdrop?.remove();
                el.style.visibility = '';
            };

            clone.style.transition = `transform ${RESTORE_MS}ms ease-out`;
            clone.style.transform = 'translate(0px, 0px) scale(1)';

            if (backdrop) {
                backdrop.style.transition = `opacity ${RESTORE_MS}ms ease-out`;
                backdrop.style.opacity = '0';
            }

            clone.addEventListener('transitionend', cleanup, { once: true });
            // Vangnet als transitionend niet vuurt (bv. interrupted reflow).
            window.setTimeout(cleanup, RESTORE_MS + 100);
        }

        state.onTouchStart = begin;
        state.onTouchMove = move;
        state.onTouchEnd = end;

        el.addEventListener('touchstart', begin, { passive: false });
        el.addEventListener('touchmove', move, { passive: false });
        el.addEventListener('touchend', end, { passive: true });
        el.addEventListener('touchcancel', end, { passive: true });

        el._pinchZoom = state;
    },
    unmounted(el): void {
        const state = el._pinchZoom;

        if (!state) {
            return;
        }

        el.removeEventListener('touchstart', state.onTouchStart);
        el.removeEventListener('touchmove', state.onTouchMove);
        el.removeEventListener('touchend', state.onTouchEnd);
        el.removeEventListener('touchcancel', state.onTouchEnd);

        state.clone?.remove();
        state.backdrop?.remove();
        el.style.visibility = '';
        el._pinchZoom = undefined;
    },
};
