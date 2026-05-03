<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { externalApi } from '@/spa/http/externalApi';
import userIcon from '../../../../svg/doodle-icons/user.svg';

const { t } = useTranslations();
const router = useRouter();

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

const suggestions = [
    t('Family'),
    t('Grandparents'),
    t('Friends'),
    t('Babysitter'),
    t('Neighbors'),
];

const form = useApiForm({ name: '' }, externalApi);

function pickSuggestion(name: string): void {
    form.data.name = name;
}

async function submit(): Promise<void> {
    await form.post<{ data: { id: number; name: string } }>('/circles', {
        onSuccess: (response) => {
            router.push({
                name: 'spa.onboarding.invite-members',
                params: { circle: response.data.id },
            });
        },
    });
}

function skip(): void {
    router.push({ name: 'spa.onboarding.notifications' });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-warmwhite px-6 text-sand-900 dark:bg-sand-900 dark:text-sand-100"
    >
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div
                class="absolute -top-24 -left-24 size-72 rounded-full bg-sage-200/60 blur-3xl dark:bg-sage-700/20"
            ></div>
            <div
                class="absolute top-1/3 -right-28 size-80 rounded-full bg-accent-soft/40 blur-3xl dark:bg-accent/10"
            ></div>
            <div
                class="absolute -bottom-32 left-1/4 size-96 rounded-full bg-sand-200/50 blur-3xl dark:bg-sand-700/30"
            ></div>
        </div>

        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-10 text-center">
                <p class="tracking-widest text-accent uppercase">
                    {{ t('Your first circle') }}
                </p>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-teal"
                >
                    {{ t('Who matters most?') }}
                </h1>
                <p class="mt-3 text-sand-600 dark:text-sand-400">
                    {{
                        t(
                            'Give your first circle a name. You can always add more people and circles later.',
                        )
                    }}
                </p>
            </div>

            <div class="w-full max-w-sm space-y-5">
                <div
                    class="relative rounded-lg bg-white/50 p-5 shadow-sm backdrop-blur-sm dark:border-sand-700/50 dark:bg-sand-800/60"
                >
                    <div class="flex items-start gap-4">
                        <div
                            class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-teal dark:bg-sage-900/40"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-7 bg-current"
                                :style="iconMaskStyle(userIcon)"
                            ></span>
                        </div>
                        <div class="flex-1">
                            <label
                                for="circle-name"
                                class="tracking-wider text-sand-500 uppercase dark:text-sand-400"
                            >
                                {{ t('Circle name') }}
                            </label>
                            <input
                                id="circle-name"
                                v-model="form.data.name"
                                type="text"
                                :placeholder="t('Circle name...')"
                                maxlength="255"
                                autofocus
                                class="mt-1 w-full border-0 bg-transparent p-0 font-sans text-xl font-semibold text-sand-900 placeholder-sand-400 focus:ring-0 focus:outline-none dark:text-sand-100 dark:placeholder-sand-500"
                            />
                        </div>
                    </div>
                    <p v-if="form.errors.name" class="mt-2 text-blush-500">
                        {{ form.errors.name }}
                    </p>
                </div>

                <div>
                    <p
                        class="mb-2 tracking-wider text-sand-500 uppercase dark:text-sand-400"
                    >
                        {{ t('Inspiration') }}
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="suggestion in suggestions"
                            :key="suggestion"
                            type="button"
                            class="rounded-full bg-white/70 px-4 py-2 text-sand-700 shadow-sm transition hover:bg-white dark:border-sand-700/50 dark:bg-sand-800/60 dark:text-sand-200 dark:hover:bg-sand-800"
                            :class="
                                form.data.name === suggestion
                                    ? 'border-teal/40 bg-sage-100 text-teal dark:border-teal/40 dark:bg-sage-900/40 dark:text-sage-100'
                                    : ''
                            "
                            @click="pickSuggestion(suggestion)"
                        >
                            {{ suggestion }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="w-full rounded-lg bg-teal py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-teal-light disabled:opacity-40"
                :disabled="!form.data.name.trim() || form.processing"
                @click="submit"
            >
                {{ form.processing ? t('Creating...') : t('Create circle') }}
            </button>
            <button
                class="mt-3 w-full py-2 text-sand-500 dark:text-sand-400"
                @click="skip"
            >
                {{ t('Skip for now') }}
            </button>
        </div>
    </div>
</template>
