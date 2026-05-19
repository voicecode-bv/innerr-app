<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { trackOnboardingStep } from '@/spa/http/onboarding';
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
            trackOnboardingStep('first_circle');
            router.push({
                name: 'spa.onboarding.circle-permissions',
                params: { circle: response.data.id },
            });
        },
    });
}

function skip(): void {
    trackOnboardingStep('first_circle');
    router.push({ name: 'spa.onboarding.notifications' });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-ink"
    >
        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-10 text-center">
                <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success-ink shadow-sm"
                >
                    {{ t('Your first circle') }}
                </span>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-ink"
                >
                    {{ t('Who matters most?') }}
                </h1>
                <p class="mt-3 text-ink-muted">
                    {{
                        t(
                            'Give your first circle a name. You can always add more people and circles later.',
                        )
                    }}
                </p>
            </div>

            <div class="w-full max-w-sm space-y-5">
                <div
                    class="relative rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <div class="flex items-start gap-4">
                        <div
                            class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-success-soft text-ink"
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
                                class="tracking-wider text-ink-muted uppercase"
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
                                class="mt-1 w-full border-0 bg-transparent p-0 font-sans text-xl font-semibold text-ink placeholder-ink-muted/50 focus:ring-0 focus:outline-none"
                            />
                        </div>
                    </div>
                    <p v-if="form.errors.name" class="mt-2 text-destructive-ink">
                        {{ form.errors.name }}
                    </p>
                </div>

                <div>
                    <p class="mb-2 tracking-wider text-ink-muted uppercase">
                        {{ t('Inspiration') }}
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button
                            v-for="suggestion in suggestions"
                            :key="suggestion"
                            type="button"
                            class="rounded-full bg-surface/70 px-4 py-2 text-ink shadow-sm transition hover:bg-surface"
                            :class="
                                form.data.name === suggestion
                                    ? 'border-action/40 bg-success-soft text-ink'
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
                class="w-full rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:opacity-40"
                :disabled="!form.data.name.trim() || form.processing"
                @click="submit"
            >
                {{ form.processing ? t('Creating...') : t('Create circle') }}
            </button>
            <button class="mt-3 w-full py-2 text-ink-muted" @click="skip">
                {{ t('Skip for now') }}
            </button>
        </div>
    </div>
</template>
