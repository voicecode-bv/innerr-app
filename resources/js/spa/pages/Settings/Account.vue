<script setup lang="ts">
import { Dialog, Events, Off, On } from '@nativephp/mobile';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useAuthStore } from '@/spa/stores/auth';
import { externalApi } from '@/spa/http/externalApi';
import downloadIcon from '../../../../svg/doodle-icons/arrow-circle-down.svg';
import userDeleteIcon from '../../../../svg/doodle-icons/user-delete.svg';

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();

const accountError = ref<string | null>(null);
const exportError = ref<string | null>(null);
const exportSuccess = ref(false);
const isDeleting = ref(false);

const exportForm = useApiForm({}, externalApi);

function goBack(): void {
    router.push({ name: 'spa.settings' });
}

async function requestExport(): Promise<void> {
    exportError.value = null;
    exportSuccess.value = false;
    try {
        await exportForm.post('/account/export', {
            onSuccess: () => {
                exportSuccess.value = true;
            },
        });
        // 422-validatie wordt door useApiForm in `errors` gezet zonder te
        // throwen — in dat geval is `onSuccess` niet gevuurd.
        if (!exportSuccess.value) {
            const fallback = t(
                'We could not request your data export. Please try again later.',
            );
            exportError.value = Object.values(exportForm.errors)[0] || fallback;
        }
    } catch (error) {
        exportError.value =
            (error as Error).message ||
            t('We could not request your data export. Please try again later.');
    }
}

async function confirmDelete(): Promise<void> {
    await Dialog.alert()
        .confirm(
            t('Delete account'),
            t(
                'This cannot be undone. Your profile will be anonymized and your photos and videos will be permanently deleted.',
            ),
        )
        .id('delete-account-confirm');
}

async function handleButtonPressed(payload: {
    index: number;
    id?: string | null;
}): Promise<void> {
    if (payload.id !== 'delete-account-confirm' || payload.index !== 1) {
        return;
    }

    isDeleting.value = true;
    accountError.value = null;

    try {
        await externalApi.delete('/account');
        try {
            await auth.logout();
        } catch {
            // BFF logout fails are non-fatal — externe API account is al weg.
        }
    } catch (error) {
        accountError.value =
            (error as Error).message ??
            t('We could not delete your account. Please try again later.');
    } finally {
        isDeleting.value = false;
        auth.clear();
        router.push({ name: 'spa.login' });
    }
}

onMounted(() => On(Events.Alert.ButtonPressed, handleButtonPressed));
onUnmounted(() => Off(Events.Alert.ButtonPressed, handleButtonPressed));
</script>

<template>
    <AppLayout :title="t('Account')">
        <template #header-left>
            <button
                class="flex items-center text-teal dark:text-sand-300"
                @click="goBack"
            >
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
                    <h3
                        class="flex items-center gap-3 font-semibold text-sand-900 dark:text-sand-100"
                    >
                        <IconTile :icon="downloadIcon" size="sm" tone="sage" />
                        {{ t('Download your data') }}
                    </h3>

                    <p class="mt-3 text-sand-700 dark:text-sand-300">
                        {{
                            t(
                                'Request an email with a download link to all your data. The link is valid for 24 hours.',
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
                            v-if="exportSuccess"
                            class="mt-4 rounded-lg bg-sage-100/70 px-4 py-3 text-sage-700 dark:bg-sage-800/40 dark:text-sage-200"
                        >
                            {{
                                t(
                                    'Check your inbox, we sent you a download link.',
                                )
                            }}
                        </div>
                        <Button
                            v-else
                            size="lg"
                            block
                            class="mt-4"
                            :disabled="exportForm.processing"
                            @click="requestExport"
                        >
                            {{
                                exportForm.processing
                                    ? t('Preparing your download...')
                                    : t('Request download')
                            }}
                        </Button>
                    </Transition>

                    <p
                        v-if="exportError"
                        class="mt-4 rounded-lg bg-blush-50 p-3 text-blush-700 dark:bg-blush-900/30 dark:text-blush-200"
                    >
                        {{ exportError }}
                    </p>
                </SurfaceCard>

                <SurfaceCard class="reveal-item">
                    <h3
                        class="flex items-center gap-3 font-semibold text-sand-900 dark:text-sand-100"
                    >
                        <IconTile
                            :icon="userDeleteIcon"
                            size="sm"
                            tone="sage"
                        />
                        {{ t('Delete account') }}
                    </h3>

                    <p class="mt-3 text-sand-700 dark:text-sand-300">
                        {{
                            t(
                                'Deleting your account removes your personal data in line with GDPR. The following happens:',
                            )
                        }}
                    </p>

                    <ul
                        class="mt-3 list-disc space-y-1 pl-5 text-sand-700 dark:text-sand-300"
                    >
                        <li>
                            {{
                                t(
                                    'Your name, username, email, avatar and bio are permanently removed.',
                                )
                            }}
                        </li>
                        <li>
                            {{
                                t(
                                    'All of your posts, including photos and videos, are permanently deleted.',
                                )
                            }}
                        </li>
                        <li>
                            {{
                                t(
                                    'All of your comments and likes are permanently deleted.',
                                )
                            }}
                        </li>
                        <li>
                            {{
                                t(
                                    'Circles you created are deleted along with everything in them.',
                                )
                            }}
                        </li>
                        <li>{{ t('This action cannot be undone.') }}</li>
                    </ul>

                    <Button
                        variant="danger"
                        size="lg"
                        block
                        class="mt-6"
                        :disabled="isDeleting"
                        @click="confirmDelete"
                    >
                        {{ t('Delete my account') }}
                    </Button>

                    <p
                        v-if="accountError"
                        class="mt-4 rounded-lg bg-blush-50 p-3 text-blush-700 dark:bg-blush-900/30 dark:text-blush-200"
                    >
                        {{ accountError }}
                    </p>
                </SurfaceCard>
            </div>
        </div>
    </AppLayout>
</template>
