<script setup lang="ts">
import { Dialog } from '@nativephp/mobile';
import { computed, ref, watch } from 'vue';
import BottomSheet from '@/components/BottomSheet.vue';
import IconTile from '@/components/IconTile.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import { type Circle } from '@/spa/stores/circles';
import usersIcon from '../../../svg/doodle-icons/user.svg';

type RowStatus = 'idle' | 'pending' | 'invited' | 'already';

const props = defineProps<{
    open: boolean;
    username: string;
    personName: string;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const { t } = useTranslations();

const circles = ref<Circle[]>([]);
const isLoading = ref(false);
const loadError = ref<string | null>(null);
const rowStatus = ref<Record<string, RowStatus>>({});

const invitableCircles = computed<Circle[]>(() =>
    circles.value.filter(
        (c) => c.is_owner === true || c.members_can_invite === true,
    ),
);

async function loadCircles(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;
    try {
        const resp = await externalApi.get<{ data: Circle[] }>(
            `/circles?not_member_username=${encodeURIComponent(props.username)}`,
        );
        circles.value = resp.data;
    } catch {
        loadError.value = t('Could not load circles');
    } finally {
        isLoading.value = false;
    }
}

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        rowStatus.value = {};
        void loadCircles();
    },
    { immediate: true },
);

function close(): void {
    emit('update:open', false);
}

function onSheetUpdate(value: boolean): void {
    if (!value) {
        close();
    } else {
        emit('update:open', true);
    }
}

async function inviteTo(circle: Circle): Promise<void> {
    if (rowStatus.value[circle.id] === 'pending') return;
    if (rowStatus.value[circle.id] === 'invited') return;

    rowStatus.value = { ...rowStatus.value, [circle.id]: 'pending' };

    try {
        await externalApi.post(`/circles/${circle.id}/members`, {
            username: props.username,
        });
        rowStatus.value = { ...rowStatus.value, [circle.id]: 'invited' };
    } catch (error) {
        if (error instanceof ApiError) {
            const apiMessage =
                error.errors.username?.[0] ?? error.errors.email?.[0] ?? '';
            const normalized = apiMessage.toLowerCase();

            if (normalized.includes('already')) {
                rowStatus.value = {
                    ...rowStatus.value,
                    [circle.id]: 'already',
                };
                return;
            }

            if (error.status === 429) {
                void Dialog.alert(
                    t('Slow down a moment'),
                    t('Too many invitations sent. Please try again later.'),
                );
            } else {
                void Dialog.alert(
                    t('Could not invite'),
                    apiMessage || t('Failed to invite member'),
                );
            }
        } else {
            void Dialog.alert(
                t('Could not invite'),
                t('Failed to invite member'),
            );
        }

        rowStatus.value = { ...rowStatus.value, [circle.id]: 'idle' };
    }
}
</script>

<template>
    <BottomSheet :open="open" @update:open="onSheetUpdate">
        <template #header>
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-sand-700 dark:text-sand-300">
                    {{ t('Invite :name to a circle', { name: personName }) }}
                </h2>
                <button
                    class="text-sand-500 dark:text-sand-400"
                    :aria-label="t('Close')"
                    @click="close"
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
                            d="M6 18 18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </template>

        <div
            v-if="isLoading && invitableCircles.length === 0"
            class="flex items-center justify-center px-4 py-10 pb-24"
        >
            <svg
                class="size-6 animate-spin text-sand-400 dark:text-sand-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                />
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
        </div>

        <div
            v-else-if="loadError"
            class="px-4 py-10 pb-24 text-center"
        >
            <p class="text-blush-500">{{ loadError }}</p>
            <button
                class="mt-2 text-sand-500 dark:text-sand-400"
                @click="loadCircles()"
            >
                {{ t('Try again') }}
            </button>
        </div>

        <div
            v-else-if="invitableCircles.length === 0"
            class="px-4 py-10 pb-24 text-center"
        >
            <p class="text-sand-600 dark:text-sand-300">
                {{ t('No circles available to invite to') }}
            </p>
        </div>

        <ul v-else class="pb-24">
            <li
                v-for="circle in invitableCircles"
                :key="circle.id"
                class="border-b border-sand-50 dark:border-sand-800"
            >
                <button
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
                    :disabled="
                        rowStatus[circle.id] === 'pending' ||
                        rowStatus[circle.id] === 'invited' ||
                        rowStatus[circle.id] === 'already'
                    "
                    @click="inviteTo(circle)"
                >
                    <img
                        v-if="circle.photo"
                        :src="circle.photo"
                        :alt="circle.name"
                        class="size-12 shrink-0 rounded-full object-cover"
                    />
                    <IconTile
                        v-else
                        :icon="usersIcon"
                        size="md"
                        tone="sage"
                        class="!rounded-full"
                    />
                    <div class="min-w-0 flex-1">
                        <p
                            class="truncate font-semibold text-sand-800 dark:text-sand-100"
                        >
                            {{ circle.name }}
                        </p>
                        <p
                            v-if="typeof circle.members_count === 'number'"
                            class="truncate text-sand-500 dark:text-sand-400"
                        >
                            {{
                                circle.members_count === 1
                                    ? t(':count member', {
                                          count: circle.members_count,
                                      })
                                    : t(':count members', {
                                          count: circle.members_count,
                                      })
                            }}
                        </p>
                    </div>
                    <span
                        v-if="rowStatus[circle.id] === 'pending'"
                        class="text-sand-500 dark:text-sand-400"
                    >
                        <svg
                            class="size-5 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                class="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                stroke-width="4"
                            />
                            <path
                                class="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                    </span>
                    <span
                        v-else-if="rowStatus[circle.id] === 'invited'"
                        class="text-sage-700 dark:text-sage-300"
                    >
                        {{ t('Invited') }}
                    </span>
                    <span
                        v-else-if="rowStatus[circle.id] === 'already'"
                        class="text-sand-500 dark:text-sand-400"
                    >
                        {{ t('Already in circle') }}
                    </span>
                    <span v-else class="text-teal">
                        {{ t('Invite') }}
                    </span>
                </button>
            </li>
        </ul>
    </BottomSheet>
</template>