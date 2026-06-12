<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '@/spa/stores/i18n';
import { Browser } from '@nativephp/mobile';
import appleButtonEn from '../../../../svg/apple-button-en.png';
import appleButtonNl from '../../../../svg/apple-button-nl.png';

const props = defineProps<{
    url: string;
    label: string;
}>();

const i18n = useI18nStore();
const src = computed(() =>
    i18n.locale === 'nl' ? appleButtonNl : appleButtonEn,
);

// Browser.auth is fire-and-forget: the native shell starts the auth session
// and returns the callback result via the deeplink scheme, not via this
// promise. We deliberately ignore the returned value.
async function go(): Promise<void> {
    await Browser.auth(props.url);
}
</script>

<template>
    <img
        :src="src"
        :alt="label"
        class="block h-auto w-full cursor-pointer"
        @click="go"
    />
</template>
