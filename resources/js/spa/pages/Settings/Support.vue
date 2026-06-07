<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { sendSupportRequest } from '@/spa/services/support';
import { useAuthStore } from '@/spa/stores/auth';

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();
const { isIos, isAndroid, ensureDetected } = usePlatform();

const message = ref('');
const processing = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

function resolvePlatform(): 'ios' | 'android' | 'web' {
    if (isIos.value) {
        return 'ios';
    }

    if (isAndroid.value) {
        return 'android';
    }

    return 'web';
}

async function submit(): Promise<void> {
    if (processing.value || message.value.trim() === '') {
        return;
    }

    processing.value = true;
    error.value = null;

    try {
        await ensureDetected();

        await sendSupportRequest(
            message.value.trim(),
            auth.appVersion,
            resolvePlatform(),
        );

        sent.value = true;
        message.value = '';
    } catch (err) {
        if (err instanceof ApiError && err.status === 422) {
            error.value =
                err.errors.message?.[0] ??
                t('Please enter a message before sending.');
        } else {
            error.value = t(
                'We could not send your message. Please try again later.',
            );
        }
    } finally {
        processing.value = false;
    }
}
</script>

<template>
    <AppLayout :title="t('Support')">
        <template #header-left>
            <button class="flex items-center text-ink" @click="goBack">
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
        </template>

        <div
            class="relative mt-10 min-h-full pb-[calc(theme(spacing.40)+env(safe-area-inset-bottom))]"
        >
            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <SurfaceCard class="reveal-item">
                    <h3 class="font-semibold text-ink">
                        {{ t('How can we help?') }}
                    </h3>

                    <p class="mt-3 text-ink">
                        {{
                            t(
                                'Describe your question or problem and we will get back to you by email.',
                            )
                        }}
                    </p>

                    <Transition
                        enter-active-class="transition duration-200 ease-out"
                        enter-from-class="opacity-0"
                        enter-to-class="opacity-100"
                        leave-active-class="transition duration-150 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                        mode="out-in"
                    >
                        <div
                            v-if="sent"
                            class="mt-4 rounded-lg bg-success-soft/70 px-4 py-3 text-success-ink"
                        >
                            {{
                                t(
                                    'Thanks, we received your message and will be in touch.',
                                )
                            }}
                        </div>

                        <form v-else class="mt-4" @submit.prevent="submit">
                            <textarea
                                v-model="message"
                                class="field-area"
                                rows="6"
                                maxlength="5000"
                                :placeholder="t('Write your message...')"
                            />

                            <p
                                v-if="error"
                                class="mt-3 rounded-lg bg-destructive-soft p-3 text-destructive-ink"
                            >
                                {{ error }}
                            </p>

                            <Button
                                type="submit"
                                size="lg"
                                block
                                class="mt-4"
                                :disabled="processing || message.trim() === ''"
                            >
                                {{
                                    processing
                                        ? t('Sending...')
                                        : t('Send message')
                                }}
                            </Button>
                        </form>
                    </Transition>
                </SurfaceCard>
            </div>
        </div>
    </AppLayout>
</template>
