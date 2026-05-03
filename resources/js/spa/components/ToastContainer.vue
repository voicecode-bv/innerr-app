<script setup lang="ts">
import { useToastsStore } from '@/spa/stores/toasts';

const toasts = useToastsStore();

const variantClasses: Record<string, string> = {
    success: 'bg-sage-100 text-sage-800 dark:bg-sage-900/80 dark:text-sage-100',
    error: 'bg-blush-100 text-blush-800 dark:bg-blush-900/80 dark:text-blush-100',
    info: 'bg-sand-100 text-sand-800 dark:bg-sand-800 dark:text-sand-100',
};
</script>

<template>
    <Teleport to="body">
        <div
            class="pointer-events-none fixed inset-x-0 z-[10000] flex flex-col items-center gap-2 px-4"
            style="top: calc(env(safe-area-inset-top) + 1rem)"
        >
            <TransitionGroup
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="-translate-y-2 opacity-0"
                enter-to-class="translate-y-0 opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="translate-y-0 opacity-100"
                leave-to-class="-translate-y-2 opacity-0"
                tag="div"
                class="flex w-full max-w-sm flex-col gap-2"
            >
                <div
                    v-for="toast in toasts.toasts"
                    :key="toast.id"
                    role="status"
                    class="pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 shadow-md"
                    :class="variantClasses[toast.variant]"
                >
                    <span class="flex-1">{{ toast.message }}</span>
                    <button
                        type="button"
                        class="-mr-1 size-5 shrink-0 opacity-60 hover:opacity-100"
                        :aria-label="'Dismiss'"
                        @click="toasts.dismiss(toast.id)"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="size-4"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M6 18 18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>
