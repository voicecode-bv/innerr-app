<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { Browser } from '@nativephp/mobile';
import { computed } from 'vue';
import googleButtonEn from '../../../svg/google-button-en.png';
import googleButtonNl from '../../../svg/google-button-nl.png';

const props = defineProps<{
    url: string;
    label: string;
}>();

const page = usePage();
const locale = computed(() => page.props.locale as string);
const src = computed(() =>
    locale.value === 'nl' ? googleButtonNl : googleButtonEn,
);

async function go() {
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
