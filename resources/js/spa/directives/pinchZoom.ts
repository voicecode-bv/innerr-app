import type { Directive } from 'vue';

// Pinch-to-zoom voor feed-foto's. We laten de originele <img> staan en tillen
// een fixed-positioned kloon boven een donkere backdrop uit, zodat de
// `overflow-hidden` van de PostCard-container het ingezoomde beeld niet
// afknipt en de verticale feed-scroll niet meeschuift. Bij het loslaten veert
// de kloon terug naar zijn oorspronkelijke plek (Instagram-stijl).

interface PinchState {
    clone: HTMLImageElement | null;
    backdrop: HTMLDivElement | null;
    startDistance: number;
    startMidX: number;
    startMidY: number;
    active: boolean;
    onTouchStart: (event: TouchEvent) => void;
    onTouchMove: (event: TouchEvent) => void;
    onTouchEnd: (event: TouchEvent) => void;
}

type PinchHost = HTMLImageElement & { _pinchZoom?: PinchState };

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

        function begin(event: TouchEvent): void {
            if (event.touches.length !== 2 || state.active) {
                return;
            }

            const [a, b] = [event.touches[0], event.touches[1]];
            const rect = el.getBoundingClientRect();
            const midX = (a.clientX + b.clientX) / 2;
            const midY = (a.clientY + b.clientY) / 2;

            state.active = true;
            state.startDistance = distanceBetween(a, b);
            state.startMidX = midX;
            state.startMidY = midY;

            const backdrop = document.createElement('div');
            backdrop.style.cssText =
                'position:fixed;inset:0;background:#000;opacity:0;z-index:9998;touch-action:none;will-change:opacity;';
            document.body.appendChild(backdrop);
            state.backdrop = backdrop;

            const clone = el.cloneNode(true) as HTMLImageElement;
            clone.style.cssText =
                `position:fixed;top:${rect.top}px;left:${rect.left}px;` +
                `width:${rect.width}px;height:${rect.height}px;margin:0;` +
                `object-fit:${getComputedStyle(el).objectFit};z-index:9999;` +
                `transform-origin:${midX - rect.left}px ${midY - rect.top}px;` +
                'will-change:transform;pointer-events:none;';
            document.body.appendChild(clone);
            state.clone = clone;

            // Verberg het origineel zodat we geen dubbele foto zien; de lopende
            // touch-sequence blijft op dit element gericht.
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
