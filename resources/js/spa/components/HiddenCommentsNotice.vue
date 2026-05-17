<script setup lang="ts">
import { computed } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import lockIcon from '../../../svg/doodle-icons/lock.svg';

const props = defineProps<{ count: number }>();

const { t } = useTranslations();

const label = computed(() =>
    props.count === 1
        ? t('1 reaction hidden from other circles')
        : t(':count reactions hidden from other circles', {
              count: props.count,
          }),
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
    <div
        class="flex items-center justify-center gap-2 px-4 py-2 text-sm text-teal-muted/80"
    >
        <span
            aria-hidden="true"
            class="inline-block size-4 bg-current"
            :style="iconMaskStyle(lockIcon)"
        ></span>
        <span>{{ label }}</span>
    </div>
</template>
