<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import {
    acquireBackgroundScale,
    releaseBackgroundScale,
} from '@/spa/composables/useBackgroundScale';
import { haptics } from '@/spa/services/haptics';
import {
    createVelocityTracker,
    prefersReducedMotion,
    settleDurationMs,
} from '@/spa/services/motion';

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const sheetRef = useTemplateRef<HTMLDivElement>('sheetRef');

const isIos =
    typeof navigator !== 'undefined' &&
    (/iP(hone|ad|od)/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

let focusOutTimer: number | null = null;
let savedBodyOverflow = '';
let savedBodyTouchAction = '';
let savedHtmlOverflow = '';

const keyboardOpen = ref(false);
const dragOffset = ref(0);
const isDragging = ref(false);
const mounted = ref(false);
// Separate visual open state. We want the sheet element to first render a
// frame in `translate-y-full` before transitioning to 0, otherwise the
// sheet appears without animation on the very first open.
const displayOpen = ref(false);

let dragStartY = 0;
let dragPointerId: number | null = null;
// Haptic arming: tick once when the drag crosses the dismiss threshold,
// re-arm when it moves back under so a hesitating drag ticks again.
let dismissArmed = false;
const velocityTracker = createVelocityTracker();
// Settle duration scales with release velocity (fast flick = quick settle).
const settleDuration = ref(300);

const DISMISS_THRESHOLD = 80;
// Below the position threshold a fast downward flick still dismisses.
const FLICK_VELOCITY = 0.5; // px/ms
const FLICK_MIN_OFFSET = 24;

function lockBodyScroll() {
    const body = document.body;
    const html = document.documentElement;

    savedBodyOverflow = body.style.overflow;
    savedBodyTouchAction = body.style.touchAction;
    savedHtmlOverflow = html.style.overflow;
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    html.style.overflow = 'hidden';
}

function unlockBodyScroll() {
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.touchAction = savedBodyTouchAction;
    document.documentElement.style.overflow = savedHtmlOverflow;
}

// iOS WKWebView keeps routing scroll gestures through to the page behind
// despite `overflow:hidden` and `overscroll-behavior:contain`. So we
// intercept all touchmoves in the capture phase:
// - Outside the sheet → always block.
// - Inside the sheet → only block when the user tries to scroll beyond
// what the content allows (iNoBounce pattern), so the bounce does not
// leak through to the feed.
let touchStartY = 0;
let touchStartX = 0;

function onCaptureTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
        touchStartY = event.touches[0].clientY;
        touchStartX = event.touches[0].clientX;
    }
}

function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
    let node: HTMLElement | null = start;

    while (node && sheetRef.value && sheetRef.value.contains(node)) {
        const style = window.getComputedStyle(node);
        const canScrollY =
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            node.scrollHeight > node.clientHeight;

        if (canScrollY) {
            return node;
        }

        if (node === sheetRef.value) {
            break;
        }

        node = node.parentElement;
    }

    return null;
}

// Mirrors findScrollableAncestor for horizontal scrollers (e.g. the CirclePicker
// row). Without this the capture-phase blocker treats a horizontally-scrollable
// child as non-scrollable and kills its swipe.
function findHorizontalScrollableAncestor(
    start: HTMLElement | null,
): HTMLElement | null {
    let node: HTMLElement | null = start;

    while (node && sheetRef.value && sheetRef.value.contains(node)) {
        const style = window.getComputedStyle(node);
        const canScrollX =
            (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
            node.scrollWidth > node.clientWidth;

        if (canScrollX) {
            return node;
        }

        if (node === sheetRef.value) {
            break;
        }

        node = node.parentElement;
    }

    return null;
}

function blockBackgroundTouchMove(event: TouchEvent): void {
    const target = event.target as HTMLElement | null;

    if (!target || !sheetRef.value || !sheetRef.value.contains(target)) {
        event.preventDefault();

        return;
    }

    const deltaX = event.touches[0].clientX - touchStartX;
    const deltaY = event.touches[0].clientY - touchStartY;

    // Horizontal-dominant swipe over a horizontally scrollable element
    // (e.g. the CirclePicker row): let the browser scroll it natively.
    if (
        Math.abs(deltaX) > Math.abs(deltaY) &&
        findHorizontalScrollableAncestor(target)
    ) {
        return;
    }

    const scrollEl = findScrollableAncestor(target);

    if (!scrollEl) {
        // Target is inside the sheet but in a non-scrollable section
        // (e.g. footer with input) — don't move anything.
        event.preventDefault();

        return;
    }

    const atTop = scrollEl.scrollTop <= 0;
    const atBottom =
        scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;

    if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault();
    }
}

function setKeyboardInset(offset: number) {
    document.documentElement.style.setProperty('--kb-inset', `${offset}px`);
}

function isTextInputFocused(): boolean {
    const active = document.activeElement as HTMLElement | null;

    if (!active || !sheetRef.value?.contains(active)) {
        return false;
    }

    if (active.tagName === 'TEXTAREA' || active.isContentEditable) {
        return true;
    }

    if (active.tagName === 'INPUT') {
        const type = (active as HTMLInputElement).type;

        return ![
            'button',
            'submit',
            'reset',
            'checkbox',
            'radio',
            'file',
            'image',
            'range',
            'color',
        ].includes(type);
    }

    return false;
}

function readOffset(): number {
    if (!isIos) {
        return 0;
    }

    const vv = window.visualViewport;

    if (!vv) {
        return 0;
    }

    return Math.max(0, window.innerHeight - vv.height);
}

function updateKeyboardOffset() {
    setKeyboardInset(readOffset());
}

function sampleRepeatedly() {
    // iOS WKWebView sometimes fires visualViewport.resize 100–400ms after focus.
    requestAnimationFrame(updateKeyboardOffset);
    window.setTimeout(updateKeyboardOffset, 150);
    window.setTimeout(updateKeyboardOffset, 400);
}

function onFocusIn() {
    if (focusOutTimer !== null) {
        window.clearTimeout(focusOutTimer);
        focusOutTimer = null;
    }

    if (isTextInputFocused()) {
        keyboardOpen.value = true;
    }

    sampleRepeatedly();
}

function onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;

    if (next && sheetRef.value?.contains(next)) {
        return;
    }

    if (focusOutTimer !== null) {
        window.clearTimeout(focusOutTimer);
    }

    focusOutTimer = window.setTimeout(() => {
        setKeyboardInset(0);
        keyboardOpen.value = false;
        focusOutTimer = null;
    }, 50);
}

function close() {
    emit('update:open', false);
}

function onBackdropTap() {
    haptics.impactLight();
    close();
}

function onHandlePointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
    }

    const target = event.target as HTMLElement | null;

    if (
        target?.closest('button, a, input, textarea, select, [role="button"]')
    ) {
        return;
    }

    dragPointerId = event.pointerId;
    dragStartY = event.clientY;
    isDragging.value = true;
    dragOffset.value = 0;
    dismissArmed = false;
    velocityTracker.start(event.clientY);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onHandlePointerMove(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== dragPointerId) {
        return;
    }

    velocityTracker.move(event.clientY);
    dragOffset.value = Math.max(0, event.clientY - dragStartY);

    if (!dismissArmed && dragOffset.value > DISMISS_THRESHOLD) {
        dismissArmed = true;
        haptics.impactLight();
    } else if (dismissArmed && dragOffset.value <= DISMISS_THRESHOLD) {
        dismissArmed = false;
    }
}

function endDrag(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== dragPointerId) {
        return;
    }

    const releaseVelocity = velocityTracker.velocity();
    const shouldClose =
        dragOffset.value > DISMISS_THRESHOLD ||
        (releaseVelocity > FLICK_VELOCITY &&
            dragOffset.value > FLICK_MIN_OFFSET);

    settleDuration.value = prefersReducedMotion()
        ? 0
        : settleDurationMs(
              shouldClose
                  ? window.innerHeight - dragOffset.value
                  : dragOffset.value,
              releaseVelocity,
          );

    isDragging.value = false;
    dragPointerId = null;
    dragOffset.value = 0;

    if (shouldClose) {
        haptics.impactMedium();
        close();
    }
}

function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && props.open) {
        close();
    }
}

let savedMainOverflow = '';
let savedMainTouchAction = '';

watch(
    () => props.open,
    (val) => {
        if (val) {
            haptics.impactLight();
            settleDuration.value = prefersReducedMotion() ? 0 : 300;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    displayOpen.value = true;
                });
            });
        } else {
            displayOpen.value = false;
        }
    },
    { immediate: true },
);

watch(
    () => props.open,
    (isOpen, wasOpen) => {
        // Sheets behind a v-if mount with `open` already true on their first
        // use; without `immediate` the open-side effects (background scale,
        // scroll lock) would only kick in from the second open onwards. The
        // guard skips the teardown branch when mounting in closed state.
        if (!isOpen && wasOpen === undefined) {
            return;
        }

        const scrollContainer = document.querySelector(
            'main',
        ) as HTMLElement | null;

        if (scrollContainer) {
            if (isOpen) {
                savedMainOverflow = scrollContainer.style.overflow;
                savedMainTouchAction = scrollContainer.style.touchAction;
                // iOS WKWebView ignores `overflow: hidden` on a momentum-
                // scrolling element. `touch-action: none` does reliably block
                // all touch-driven scrolling and also stops in-flight
                // momentum scroll, so the feed doesn't leak under the sheet.
                scrollContainer.style.overflow = 'hidden';
                scrollContainer.style.touchAction = 'none';
            } else {
                scrollContainer.style.overflow = savedMainOverflow;
                scrollContainer.style.touchAction = savedMainTouchAction;
            }
        }

        if (isOpen) {
            acquireBackgroundScale();
            lockBodyScroll();
            document.addEventListener('keydown', handleKeydown);
            document.addEventListener('touchstart', onCaptureTouchStart, {
                passive: true,
                capture: true,
            });
            document.addEventListener('touchmove', blockBackgroundTouchMove, {
                passive: false,
                capture: true,
            });
            updateKeyboardOffset();
        } else {
            releaseBackgroundScale();
            unlockBodyScroll();
            document.removeEventListener('keydown', handleKeydown);
            document.removeEventListener('touchstart', onCaptureTouchStart, {
                capture: true,
            });
            document.removeEventListener(
                'touchmove',
                blockBackgroundTouchMove,
                { capture: true },
            );
            setKeyboardInset(0);
            keyboardOpen.value = false;
        }
    },
    { immediate: true },
);

onMounted(() => {
    mounted.value = true;
    setKeyboardInset(0);
    window.visualViewport?.addEventListener('resize', updateKeyboardOffset);
    window.visualViewport?.addEventListener('scroll', updateKeyboardOffset);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('touchstart', onCaptureTouchStart, {
        capture: true,
    });
    document.removeEventListener('touchmove', blockBackgroundTouchMove, {
        capture: true,
    });
    window.visualViewport?.removeEventListener('resize', updateKeyboardOffset);
    window.visualViewport?.removeEventListener('scroll', updateKeyboardOffset);

    if (focusOutTimer !== null) {
        window.clearTimeout(focusOutTimer);
        focusOutTimer = null;
    }

    setKeyboardInset(0);
    const scrollContainer = document.querySelector(
        'main',
    ) as HTMLElement | null;

    if (scrollContainer) {
        scrollContainer.style.overflow = savedMainOverflow;
        scrollContainer.style.touchAction = savedMainTouchAction;
    }

    if (props.open) {
        releaseBackgroundScale();
        unlockBodyScroll();
    }
});
</script>

<template>
    <teleport v-if="mounted" to="body">
        <div
            :class="[
                'fixed inset-0 z-9999 touch-none bg-black/40 transition-opacity duration-300',
                displayOpen
                    ? 'pointer-events-auto opacity-100'
                    : 'pointer-events-none opacity-0',
            ]"
            @click="onBackdropTap"
            @touchmove.prevent
        />
        <div
            ref="sheetRef"
            :class="[
                'fixed inset-x-0 bottom-0 z-9999 flex flex-col rounded-2xl bg-sand shadow-2xl',
                isDragging ? '' : 'transition-transform ease-spring',
                displayOpen
                    ? 'translate-y-[calc(var(--drag-offset,0px)+var(--kb-inset,0px)*-1)]'
                    : 'translate-y-full',
            ]"
            :style="{
                maxHeight: 'calc(85dvh - var(--kb-inset, 0px))',
                '--drag-offset': `${dragOffset}px`,
                transitionDuration: isDragging
                    ? undefined
                    : `${settleDuration}ms`,
            }"
            role="dialog"
            aria-modal="true"
            @focusin="onFocusIn"
            @focusout="onFocusOut"
        >
            <div
                class="flex cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
                @pointerdown="onHandlePointerDown"
                @pointermove="onHandlePointerMove"
                @pointerup="endDrag"
                @pointercancel="endDrag"
            >
                <div class="h-1 w-10 rounded-full bg-sand-200" />
            </div>
            <div
                v-if="$slots.header"
                class="flex-shrink-0 cursor-grab touch-none border-b border-sand-100 px-4 py-3 active:cursor-grabbing"
                @pointerdown="onHandlePointerDown"
                @pointermove="onHandlePointerMove"
                @pointerup="endDrag"
                @pointercancel="endDrag"
            >
                <slot name="header" />
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <slot />
            </div>
            <div
                v-if="$slots.footer"
                :class="[
                    'shrink-0 border-t border-sand-200 bg-sand',
                    open && !keyboardOpen
                        ? 'pb-[calc(theme(spacing.3)+env(safe-area-inset-bottom))]'
                        : '',
                ]"
            >
                <slot name="footer" />
            </div>
            <!-- Opaque filler under the sheet: while the keyboard is open the
                 sheet is translated up by the keyboard inset, which would
                 otherwise expose the dimmed page behind it as a dark strip
                 between the sheet and the iOS keyboard accessory bar. -->
            <div
                aria-hidden="true"
                class="absolute inset-x-0 top-full h-[var(--kb-inset,0px)] bg-sand"
            />
        </div>
    </teleport>
</template>
