<script setup lang="ts">
/* Shared loading spinner. Pass a size class (e.g. class="size-5"); the color
   follows currentColor so it inherits the surrounding text color. */
</script>

<template>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        class="animate-spin"
        aria-hidden="true"
    >
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="3"
            stroke-opacity="0.25"
        />
        <path
            d="M22 12a10 10 0 0 1-10 10"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
        />
    </svg>
</template>
