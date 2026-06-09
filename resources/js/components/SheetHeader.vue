<script setup lang="ts">
import { useTranslations } from '@/spa/composables/useTranslations';
import AppText from './AppText.vue';

defineProps<{
    title: string;
    count?: number | null;
}>();

defineEmits<{
    (e: 'close'): void;
}>();

const { t } = useTranslations();
</script>

<template>
    <div class="flex items-center justify-between">
        <AppText variant="heading">
            {{ title }}
            <span
                v-if="typeof count === 'number' && count > 0"
                class="font-normal text-ink-muted/70"
                >({{ count }})</span
            >
        </AppText>
        <button
            class="text-ink-muted"
            :aria-label="t('Close')"
            @click="$emit('close')"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="size-5"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                />
            </svg>
        </button>
    </div>
</template>
