<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18nStore } from '@/spa/stores/i18n';

type LocaleKey = 'nl' | 'en' | 'fr';

const i18n = useI18nStore();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

const languages: { code: LocaleKey; label: string }[] = [
    { code: 'nl', label: 'Nederlands' },
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
];

function selectLocale(code: LocaleKey): void {
    i18n.set(code);
    open.value = false;
}

function handleOutside(event: MouseEvent): void {
    if (!open.value) {
return;
}

    if (root.value && !root.value.contains(event.target as Node)) {
        open.value = false;
    }
}

onMounted(() => document.addEventListener('mousedown', handleOutside));
onBeforeUnmount(() => document.removeEventListener('mousedown', handleOutside));
</script>

<template>
    <div ref="root" class="relative">
        <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-brand-sand/15 px-3 py-2 font-semibold tracking-wider text-brand-sand uppercase shadow-sm backdrop-blur-sm transition hover:scale-105 hover:bg-brand-sand/25"
            :aria-expanded="open"
            aria-haspopup="listbox"
            @click="open = !open"
        >
            <span aria-hidden="true" class="inline-block h-3 w-5">
                <!-- NL flag -->
                <svg
                    v-if="i18n.locale === 'nl'"
                    viewBox="0 0 9 6"
                    class="size-full overflow-hidden rounded-[1px]"
                    preserveAspectRatio="none"
                >
                    <rect width="9" height="2" y="0" fill="#AE1C28" />
                    <rect width="9" height="2" y="2" fill="#FFFFFF" />
                    <rect width="9" height="2" y="4" fill="#21468B" />
                </svg>
                <!-- GB flag (English) -->
                <svg
                    v-else-if="i18n.locale === 'en'"
                    viewBox="0 0 60 30"
                    class="size-full overflow-hidden rounded-[1px]"
                    preserveAspectRatio="none"
                >
                    <clipPath id="ls-gb-clip">
                        <path d="M0 0v30h60V0z" />
                    </clipPath>
                    <clipPath id="ls-gb-clip2">
                        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
                    </clipPath>
                    <g clip-path="url(#ls-gb-clip)">
                        <path fill="#012169" d="M0 0v30h60V0z" />
                        <path
                            d="M0 0l60 30m0-30L0 30"
                            stroke="#fff"
                            stroke-width="6"
                        />
                        <path
                            d="M0 0l60 30m0-30L0 30"
                            clip-path="url(#ls-gb-clip2)"
                            stroke="#C8102E"
                            stroke-width="4"
                        />
                        <path
                            d="M30 0v30M0 15h60"
                            stroke="#fff"
                            stroke-width="10"
                        />
                        <path
                            d="M30 0v30M0 15h60"
                            stroke="#C8102E"
                            stroke-width="6"
                        />
                    </g>
                </svg>
                <!-- FR flag -->
                <svg
                    v-else-if="i18n.locale === 'fr'"
                    viewBox="0 0 9 6"
                    class="size-full overflow-hidden rounded-[1px]"
                    preserveAspectRatio="none"
                >
                    <rect width="3" height="6" x="0" fill="#0055A4" />
                    <rect width="3" height="6" x="3" fill="#FFFFFF" />
                    <rect width="3" height="6" x="6" fill="#EF4135" />
                </svg>
            </span>
            <span>{{ i18n.locale }}</span>
        </button>

        <ul
            v-if="open"
            role="listbox"
            class="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-sand-200"
        >
            <li
                v-for="lang in languages"
                :key="lang.code"
                role="option"
                :aria-selected="i18n.locale === lang.code"
            >
                <button
                    type="button"
                    class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-sand-50"
                    :class="
                        i18n.locale === lang.code
                            ? 'bg-sage-50 font-semibold text-teal'
                            : 'font-medium text-teal-muted'
                    "
                    @click="selectLocale(lang.code)"
                >
                    <span aria-hidden="true" class="inline-block h-3 w-5">
                        <svg
                            v-if="lang.code === 'nl'"
                            viewBox="0 0 9 6"
                            class="size-full overflow-hidden rounded-[1px]"
                            preserveAspectRatio="none"
                        >
                            <rect width="9" height="2" y="0" fill="#AE1C28" />
                            <rect width="9" height="2" y="2" fill="#FFFFFF" />
                            <rect width="9" height="2" y="4" fill="#21468B" />
                        </svg>
                        <svg
                            v-else-if="lang.code === 'en'"
                            viewBox="0 0 60 30"
                            class="size-full overflow-hidden rounded-[1px]"
                            preserveAspectRatio="none"
                        >
                            <clipPath :id="`ls-gb-list-clip-${lang.code}`">
                                <path d="M0 0v30h60V0z" />
                            </clipPath>
                            <g
                                :clip-path="`url(#ls-gb-list-clip-${lang.code})`"
                            >
                                <path fill="#012169" d="M0 0v30h60V0z" />
                                <path
                                    d="M0 0l60 30m0-30L0 30"
                                    stroke="#fff"
                                    stroke-width="6"
                                />
                                <path
                                    d="M30 0v30M0 15h60"
                                    stroke="#fff"
                                    stroke-width="10"
                                />
                                <path
                                    d="M30 0v30M0 15h60"
                                    stroke="#C8102E"
                                    stroke-width="6"
                                />
                            </g>
                        </svg>
                        <svg
                            v-else-if="lang.code === 'fr'"
                            viewBox="0 0 9 6"
                            class="size-full overflow-hidden rounded-[1px]"
                            preserveAspectRatio="none"
                        >
                            <rect width="3" height="6" x="0" fill="#0055A4" />
                            <rect width="3" height="6" x="3" fill="#FFFFFF" />
                            <rect width="3" height="6" x="6" fill="#EF4135" />
                        </svg>
                    </span>
                    <span class="flex-1">{{ lang.label }}</span>
                    <svg
                        v-if="i18n.locale === lang.code"
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="size-4 text-teal"
                    >
                        <path d="M5 12l5 5L20 7" />
                    </svg>
                </button>
            </li>
        </ul>
    </div>
</template>
