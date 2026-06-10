<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '@/spa/stores/i18n';
import { Browser } from '@nativephp/mobile';
import googleButtonEn from '../../../../svg/google-button-en.png';
import googleButtonNl from '../../../../svg/google-button-nl.png';

const props = defineProps<{
    url: string;
    label: string;
}>();

const i18n = useI18nStore();
const src = computed(() =>
    i18n.locale === 'nl' ? googleButtonNl : googleButtonEn,
);

// Browser.auth is fire-and-forget: de native shell start de auth-sessie en
// geeft het callback-resultaat terug via de deeplink scheme, niet via deze
// promise. We negeren bewust de teruggegeven waarde.
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
