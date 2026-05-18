<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink  } from 'vue-router';
import type {RouteLocationRaw} from 'vue-router';

const props = defineProps<{
    label: string;
    to?: RouteLocationRaw;
    photo?: string | null;
    iconUrl?: string | null;
    initial?: string | null;
}>();

const hasLeading = computed(
    () =>
        Boolean(props.photo) ||
        Boolean(props.iconUrl) ||
        Boolean(props.initial),
);

function iconMaskStyle(url: string) {
    return {
        maskImage: `url(${url})`,
        WebkitMaskImage: `url(${url})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
    };
}
</script>

<template>
    <component
        :is="to ? RouterLink : 'span'"
        v-bind="to ? { to } : {}"
        :class="[
            'inline-flex items-center gap-2 rounded-full bg-white font-semibold text-teal shadow-sm ring-1 ring-sand-100',
            hasLeading ? 'py-1 pr-3.5 pl-1' : 'px-3.5 py-1.5',
            to ? 'transition-colors hover:bg-sand-50' : '',
        ]"
    >
        <img
            v-if="photo"
            :src="photo"
            :alt="label"
            class="size-7 rounded-full object-cover"
        />
        <span
            v-else-if="iconUrl || initial"
            class="flex size-7 items-center justify-center rounded-full bg-sage-100 text-teal"
        >
            <span
                v-if="iconUrl"
                aria-hidden="true"
                class="inline-block size-3.5 bg-current"
                :style="iconMaskStyle(iconUrl)"
            ></span>
            <span v-else class="font-display font-semibold uppercase">{{
                initial
            }}</span>
        </span>
        {{ label }}
        <slot name="meta" />
    </component>
</template>
