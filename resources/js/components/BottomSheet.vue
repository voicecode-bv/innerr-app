<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';

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
// Aparte visuele open-state. We willen dat het sheet-element eerst een
// frame in `translate-y-full` rendert voordat we naar 0 transitionen,
// anders verschijnt de sheet op de allereerste open zonder animatie.
const displayOpen = ref(false);

let dragStartY = 0;
let dragPointerId: number | null = null;

const DISMISS_THRESHOLD = 80;

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

// iOS WKWebView blijft scroll-gestures door-routeren naar de achterliggende
// pagina ondanks `overflow:hidden` en `overscroll-behavior:contain`. We
// onderscheppen daarom alle touchmoves in capture-phase:
// - Buiten de sheet → altijd blokkeren.
// - Binnen de sheet → alleen blokkeren wanneer de gebruiker probeert verder
// te scrollen dan de inhoud toelaat (iNoBounce-patroon), zodat de bounce
// niet doorlekt naar de feed.
let touchStartY = 0;

function onCaptureTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
        touchStartY = event.touches[0].clientY;
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
        if (node === sheetRef.value) break;
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

    const scrollEl = findScrollableAncestor(target);

    if (!scrollEl) {
        // Target zit binnen de sheet maar in een niet-scrollbaar gedeelte
        // (bv. footer met input) — niets bewegen.
        event.preventDefault();
        return;
    }

    const deltaY = event.touches[0].clientY - touchStartY;
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
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onHandlePointerMove(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== dragPointerId) {
        return;
    }

    dragOffset.value = Math.max(0, event.clientY - dragStartY);
}

function endDrag(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== dragPointerId) {
        return;
    }

    const shouldClose = dragOffset.value > DISMISS_THRESHOLD;

    isDragging.value = false;
    dragPointerId = null;
    dragOffset.value = 0;

    if (shouldClose) {
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
    (isOpen) => {
        const scrollContainer = document.querySelector(
            'main',
        ) as HTMLElement | null;

        if (scrollContainer) {
            if (isOpen) {
                savedMainOverflow = scrollContainer.style.overflow;
                savedMainTouchAction = scrollContainer.style.touchAction;
                // iOS WKWebView negeert `overflow: hidden` op een momentum-
                // scrollend element. `touch-action: none` blokkeert wel
                // betrouwbaar alle touch-gestuurde scroll en stopt ook lopende
                // momentum-scroll, zodat de feed niet doorlekt onder de sheet.
                scrollContainer.style.overflow = 'hidden';
                scrollContainer.style.touchAction = 'none';
            } else {
                scrollContainer.style.overflow = savedMainOverflow;
                scrollContainer.style.touchAction = savedMainTouchAction;
            }
        }

        if (isOpen) {
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
        unlockBodyScroll();
    }
});
</script>

<template>
    <teleport v-if="mounted" to="body">
        <div
            :class="[
                'fixed inset-0 z-9999 touch-none bg-black/50 transition-opacity duration-300',
                displayOpen
                    ? 'pointer-events-auto opacity-100'
                    : 'pointer-events-none opacity-0',
            ]"
            @click="close"
            @touchmove.prevent
        />
        <div
            ref="sheetRef"
            :class="[
                'fixed inset-x-0 bottom-0 z-9999 flex flex-col rounded-2xl bg-sand shadow-2xl',
                isDragging ? '' : 'transition-transform duration-300 ease-out',
                displayOpen
                    ? 'translate-y-[calc(var(--drag-offset,0px)+var(--kb-inset,0px)*-1)]'
                    : 'translate-y-full',
            ]"
            :style="{
                maxHeight: 'calc(85dvh - var(--kb-inset, 0px))',
                '--drag-offset': `${dragOffset}px`,
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
                        ? 'pb-24'
                        : '',
                ]"
            >
                <slot name="footer" />
            </div>
        </div>
    </teleport>
</template>
