<script setup lang="ts">
import { useTranslations } from '@/spa/composables/useTranslations';

withDefaults(
    defineProps<{
        step: number;
        totalSteps: number;
        title: string;
        subtitle?: string;
        primaryLabel: string;
        primaryDisabled?: boolean;
    }>(),
    {
        subtitle: '',
        primaryDisabled: false,
    },
);

const emit = defineEmits<{
    (e: 'next'): void;
    (e: 'back'): void;
}>();

const { t } = useTranslations();
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col bg-sand text-ink"
    >
        <div class="px-6 pt-6">
            <button
                type="button"
                class="mb-4 -ml-2 flex size-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand-100"
                :aria-label="t('Back')"
                @click="emit('back')"
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
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>
            <div class="flex items-center gap-2">
                <div
                    v-for="n in totalSteps"
                    :key="n"
                    class="h-1.5 flex-1 rounded-full transition-colors"
                    :class="n <= step ? 'bg-action' : 'bg-sand-200'"
                />
            </div>
            <p class="mt-3 text-sm text-ink-muted">
                {{
                    t('Step :current of :total', {
                        current: String(step),
                        total: String(totalSteps),
                    })
                }}
            </p>
        </div>

        <div class="flex flex-1 flex-col overflow-y-auto px-6 pt-4 pb-6">
            <div class="mb-6">
                <h1
                    class="font-display text-3xl font-black tracking-tight text-ink"
                >
                    {{ title }}
                </h1>
                <p v-if="subtitle" class="mt-2 text-ink-muted">
                    {{ subtitle }}
                </p>
            </div>

            <slot />
        </div>

        <div class="relative flex items-center gap-3 px-6 pt-2 pb-8">
            <button
                type="button"
                class="flex-1 rounded-lg bg-sand-100 py-3.5 font-semibold text-ink transition-colors hover:bg-sand-200"
                @click="emit('back')"
            >
                {{ t('Back') }}
            </button>
            <button
                type="button"
                class="flex-1 rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:opacity-40"
                :disabled="primaryDisabled"
                @click="emit('next')"
            >
                {{ primaryLabel }}
            </button>
        </div>
    </div>
</template>
