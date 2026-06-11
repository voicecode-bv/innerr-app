<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';

/* Top bar for the onboarding task steps: a back affordance on the left and
   the step progress dots in the center (same visual language as the
   CreatePost/CreateQuote wizards). The Intro welcome screen renders without
   this header. */
const props = withDefaults(
    defineProps<{
        /** 1-based position within the onboarding task steps. */
        step: number;
        total?: number;
        /** Back target: a route location, or 'history' to pop the stack. */
        backTo?: RouteLocationRaw | 'history';
    }>(),
    {
        total: 3,
        backTo: undefined,
    },
);

const router = useRouter();
const { t } = useTranslations();

function goBack(): void {
    if (props.backTo === 'history') {
        router.back();

        return;
    }

    if (props.backTo) {
        void router.push(props.backTo);
    }
}
</script>

<template>
    <div class="relative flex h-12 items-center justify-center">
        <button
            v-if="backTo"
            type="button"
            class="hit-slop absolute left-0 -ml-2 flex size-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand-100"
            :aria-label="t('Back')"
            @click="goBack"
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

        <div
            class="flex items-center gap-1.5"
            :aria-label="t('Step :current of :total', { current: step, total })"
        >
            <span
                v-for="dot in total"
                :key="dot"
                class="h-1.5 rounded-full transition-all duration-200"
                :class="
                    dot === step
                        ? 'w-8 bg-action'
                        : dot < step
                          ? 'w-4 bg-action/60'
                          : 'w-4 bg-sand-200'
                "
            />
        </div>
    </div>
</template>
