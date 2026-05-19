<script setup lang="ts">
import { Dialog } from '@nativephp/mobile';
import { computed, ref, watch } from 'vue';
import BottomSheet from '@/components/BottomSheet.vue';
import IconTile from '@/components/IconTile.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import SheetHeader from '@/components/SheetHeader.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import type { Circle, CirclePendingInvitation } from '@/spa/stores/circles';
import usersIcon from '../../../svg/doodle-icons/user.svg';

type RowState =
    | { status: 'idle' }
    | { status: 'pending' }
    | { status: 'invited'; invitationId: string; canCancel: boolean }
    | { status: 'withdrawing'; invitationId: string }
    | { status: 'already' };

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
const rowState = ref<Record<string, RowState>>({});

const invitableCircles = computed<Circle[]>(() =>
    circles.value.filter(
        (c) => c.is_owner === true || c.members_can_invite === true,
    ),
);

function rowFor(circleId: string): RowState {
    return rowState.value[circleId] ?? { status: 'idle' };
}

function setRowState(circleId: string, next: RowState): void {
    rowState.value = { ...rowState.value, [circleId]: next };
}

function initialRowStateFor(circle: Circle): RowState {
    const invitation: CirclePendingInvitation | undefined =
        circle.pending_invitations?.[0];

    if (!invitation) {
        return { status: 'idle' };
    }

    return {
        status: 'invited',
        invitationId: invitation.id,
        canCancel: invitation.can_cancel,
    };
}

function rebuildRowStates(): void {
    const next: Record<string, RowState> = {};

    for (const circle of circles.value) {
        next[circle.id] = initialRowStateFor(circle);
    }

    rowState.value = next;
}

async function loadCircles(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
        const resp = await externalApi.get<{ data: Circle[] }>(
            `/circles?not_member_username=${encodeURIComponent(props.username)}`,
        );
        circles.value = resp.data;
        rebuildRowStates();
    } catch {
        loadError.value = t('Could not load circles');
    } finally {
        isLoading.value = false;
    }
}

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) {
            return;
        }

        rowState.value = {};
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
    setRowState(circle.id, { status: 'pending' });

    try {
        const resp = await externalApi.post<{
            invitation?: {
                id: string;
                inviter_id: string;
                can_cancel: boolean;
            };
        }>(`/circles/${circle.id}/members`, {
            username: props.username,
        });

        if (resp.invitation) {
            setRowState(circle.id, {
                status: 'invited',
                invitationId: resp.invitation.id,
                canCancel: resp.invitation.can_cancel,
            });
        } else {
            setRowState(circle.id, { status: 'idle' });
        }
    } catch (error) {
        if (error instanceof ApiError) {
            const apiMessage =
                error.errors.username?.[0] ?? error.errors.email?.[0] ?? '';
            const normalized = apiMessage.toLowerCase();

            if (normalized.includes('already')) {
                setRowState(circle.id, { status: 'already' });

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

        setRowState(circle.id, { status: 'idle' });
    }
}

async function withdrawFrom(circle: Circle): Promise<void> {
    const current = rowFor(circle.id);

    if (current.status !== 'invited' || !current.canCancel) {
        return;
    }

    const invitationId = current.invitationId;
    setRowState(circle.id, { status: 'withdrawing', invitationId });

    try {
        await externalApi.delete(
            `/circles/${circle.id}/invitations/${invitationId}`,
        );
        setRowState(circle.id, { status: 'idle' });
    } catch (error) {
        const apiMessage =
            error instanceof ApiError ? (error.message ?? '') : '';

        void Dialog.alert(
            t('Could not cancel invitation'),
            apiMessage || t('Failed to cancel invitation'),
        );

        setRowState(circle.id, {
            status: 'invited',
            invitationId,
            canCancel: current.canCancel,
        });
    }
}

function onRowClick(circle: Circle): void {
    const state = rowFor(circle.id);

    if (state.status === 'pending' || state.status === 'withdrawing') {
        return;
    }

    if (state.status === 'already') {
        return;
    }

    if (state.status === 'invited') {
        if (state.canCancel) {
            void withdrawFrom(circle);
        }

        return;
    }

    void inviteTo(circle);
}

function isRowDisabled(circle: Circle): boolean {
    const state = rowFor(circle.id);

    if (state.status === 'pending' || state.status === 'withdrawing') {
        return true;
    }

    if (state.status === 'already') {
        return true;
    }

    if (state.status === 'invited' && !state.canCancel) {
        return true;
    }

    return false;
}

function canCancelInvitation(circleId: string): boolean {
    const state = rowFor(circleId);

    return state.status === 'invited' && state.canCancel;
}
</script>

<template>
    <BottomSheet :open="open" @update:open="onSheetUpdate">
        <template #header>
            <SheetHeader
                :title="t('Invite :name to a circle', { name: personName })"
                @close="close"
            />
        </template>

        <div
            v-if="isLoading && invitableCircles.length === 0"
            class="flex items-center justify-center px-4 py-10 pb-24"
        >
            <LoadingSpinner />
        </div>

        <div v-else-if="loadError" class="px-4 py-10 pb-24 text-center">
            <p class="text-destructive-ink">{{ loadError }}</p>
            <button class="mt-2 text-ink-muted" @click="loadCircles()">
                {{ t('Try again') }}
            </button>
        </div>

        <div
            v-else-if="invitableCircles.length === 0"
            class="px-4 py-10 pb-24 text-center"
        >
            <p class="text-ink-muted">
                {{ t('No circles available to invite to') }}
            </p>
        </div>

        <ul v-else class="pb-24">
            <li
                v-for="circle in invitableCircles"
                :key="circle.id"
                class="border-b border-sand-50"
            >
                <button
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
                    :disabled="isRowDisabled(circle)"
                    @click="onRowClick(circle)"
                >
                    <img
                        v-if="circle.photo"
                        :src="circle.photo"
                        :alt="circle.name"
                        class="avatar-ring size-12 shrink-0 rounded-full object-cover"
                    />
                    <IconTile
                        v-else
                        :icon="usersIcon"
                        size="md"
                        tone="sage"
                        class="!rounded-full"
                    />
                    <div class="min-w-0 flex-1">
                        <p class="truncate font-semibold text-ink">
                            {{ circle.name }}
                        </p>
                        <p
                            v-if="typeof circle.members_count === 'number'"
                            class="truncate text-ink-muted"
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
                        v-if="
                            rowFor(circle.id).status === 'pending' ||
                            rowFor(circle.id).status === 'withdrawing'
                        "
                        class="text-ink-muted"
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
                    <template
                        v-else-if="rowFor(circle.id).status === 'invited'"
                    >
                        <span
                            v-if="canCancelInvitation(circle.id)"
                            class="text-destructive-ink"
                        >
                            {{ t('Cancel invitation') }}
                        </span>
                        <span v-else class="text-ink-muted">
                            {{ t('Invited') }}
                        </span>
                    </template>
                    <span
                        v-else-if="rowFor(circle.id).status === 'already'"
                        class="text-ink-muted"
                    >
                        {{ t('Already in circle') }}
                    </span>
                    <span v-else class="text-ink">
                        {{ t('Invite') }}
                    </span>
                </button>
            </li>
        </ul>
    </BottomSheet>
</template>
