<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import { Browser } from '@nativephp/mobile';
import { computed } from 'vue';
import appleButtonEn from '../../../svg/apple-button-en.png';
import appleButtonNl from '../../../svg/apple-button-nl.png';

const props = defineProps<{
    url: string;
    label: string;
}>();

const page = usePage();
const locale = computed(() => page.props.locale as string);
const src = computed(() =>
    locale.value === 'nl' ? appleButtonNl : appleButtonEn,
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
