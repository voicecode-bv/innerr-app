<script setup lang="ts">
defineProps<{
    pullDistance: number;
    isRefreshing: boolean;
}>();
</script>

<template>
    <div
        class="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        :class="{ 'duration-0': pullDistance > 0 && !isRefreshing }"
        :style="{ height: `${pullDistance}px` }"
    >
        <span
            class="flex items-center gap-1.5"
            :class="{ 'is-refreshing': isRefreshing }"
        >
            <span class="ptr-dot ptr-dot-1 size-2 rounded-full bg-action"></span>
            <span
                class="ptr-dot ptr-dot-2 size-2 rounded-full bg-accent"
            ></span>
            <span
                class="ptr-dot ptr-dot-3 size-2 rounded-full bg-sage-500"
            ></span>
        </span>
    </div>
</template>

<style scoped>
.is-refreshing .ptr-dot {
    animation: ptr-bounce 1s ease-in-out infinite;
}
.is-refreshing .ptr-dot-1 {
    animation-delay: 0s;
}
.is-refreshing .ptr-dot-2 {
    animation-delay: 0.15s;
}
.is-refreshing .ptr-dot-3 {
    animation-delay: 0.3s;
}

@keyframes ptr-bounce {
    0%,
    80%,
    100% {
        transform: translateY(0);
        opacity: 0.5;
    }
    40% {
        transform: translateY(-6px);
        opacity: 1;
    }
}
</style>
