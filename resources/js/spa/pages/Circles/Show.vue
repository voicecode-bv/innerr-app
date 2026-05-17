<script setup lang="ts">
import { Camera, Dialog, Events, Off, On } from '@nativephp/mobile';
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import ShareInviteLinkSection from '@/spa/components/ShareInviteLinkSection.vue';
import { useApiForm } from '@/spa/composables/useApiForm';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { api, ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useCirclesStore } from '@/spa/stores/circles';
import crownIcon from '../../../../svg/doodle-icons/crown.svg';
import mailIcon from '../../../../svg/doodle-icons/mail.svg';
import sendIcon from '../../../../svg/doodle-icons/send.svg';
import userAddIcon from '../../../../svg/doodle-icons/user-add.svg';
import userRemoveIcon from '../../../../svg/doodle-icons/user-remove.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

interface Member {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    is_owner: boolean;
}

interface Invitation {
    id: string;
    email: string | null;
    username: string | null;
    created_at: string;
}

interface Circle {
    id: string;
    name: string;
    photo: string | null;
    members_count: number;
    members: Member[] | null;
    members_can_invite: boolean;
    members_can_view_members: boolean;
    members_can_download: boolean;
    is_owner: boolean;
    created_at: string;
    pending_invitations?: Invitation[];
}

const { t } = useTranslations();
const route = useRoute();
const router = useRouter();
const circlesStore = useCirclesStore();

const circleId = computed(() => String(route.params.circle));

const circle = ref<Circle | null>(null);
const invitations = ref<Invitation[]>([]);

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

async function loadData(): Promise<void> {
    try {
        const circleResp = await externalApi.get<{ data: Circle }>(
            `/circles/${circleId.value}`,
        );
        circle.value = circleResp.data;
        invitations.value = circleResp.data.pending_invitations ?? [];
    } catch {
        router.push({ name: 'spa.circles.index' });
    }
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: loadData,
    containerRef,
});

onMounted(loadData);

const isEditing = ref(false);
const inviteSent = ref(false);
const isDeleting = ref(false);
const isLeaving = ref(false);
const inviteMethod = ref<'identifier' | 'link'>('identifier');

const canInvite = computed(
    () => circle.value?.is_owner || circle.value?.members_can_invite,
);
const canSeeMembers = computed(
    () =>
        circle.value?.is_owner === true ||
        circle.value?.members_can_view_members !== false,
);
const members = computed(() => circle.value?.members ?? []);

const editForm = useApiForm({ name: '' }, externalApi);
const memberForm = useApiForm({ identifier: '' }, externalApi);

async function toggleMembersCanInvite(): Promise<void> {
    if (!circle.value) {
        return;
    }

    const next = !circle.value.members_can_invite;
    circle.value.members_can_invite = next;

    try {
        await externalApi.put(`/circles/${circleId.value}/settings`, {
            members_can_invite: next,
        });
    } catch {
        circle.value.members_can_invite = !next;
    }
}

async function toggleMembersCanViewMembers(): Promise<void> {
    if (!circle.value) {
        return;
    }

    const next = !circle.value.members_can_view_members;
    circle.value.members_can_view_members = next;

    try {
        await externalApi.put(`/circles/${circleId.value}/settings`, {
            members_can_view_members: next,
        });
    } catch {
        circle.value.members_can_view_members = !next;
    }
}

async function toggleMembersCanDownload(): Promise<void> {
    if (!circle.value) {
        return;
    }

    const next = !circle.value.members_can_download;
    circle.value.members_can_download = next;

    try {
        await externalApi.put(`/circles/${circleId.value}/settings`, {
            members_can_download: next,
        });
    } catch {
        circle.value.members_can_download = !next;
    }
}

async function updateCircle(): Promise<void> {
    await editForm.put(`/circles/${circleId.value}`, {
        onSuccess: () => {
            isEditing.value = false;

            if (circle.value) {
                circle.value.name = editForm.data.name;
            }

            circlesStore.update(circleId.value, { name: editForm.data.name });
        },
    });
}

async function deleteCircle(): Promise<void> {
    await Dialog.alert()
        .confirm(
            t('Delete circle'),
            t('Are you sure you want to delete this circle?'),
        )
        .id('delete-circle-confirm');
}

async function leaveCircle(): Promise<void> {
    await Dialog.alert()
        .confirm(
            t('Leave circle'),
            t(
                'If you leave this circle, your posts will no longer be visible to its members. Are you sure you want to leave?',
            ),
        )
        .id('leave-circle-confirm');
}

function friendlyInviteError(
    error: ApiError,
    field: 'email' | 'username',
): string {
    const apiMessage = error.errors[field]?.[0] ?? error.message;

    if (!apiMessage) {
        return t('Failed to invite member');
    }

    const normalized = apiMessage.toLowerCase();

    if (normalized.includes('selected') && normalized.includes('invalid')) {
        return field === 'email'
            ? t('No account found for this email address.')
            : t('No account found for this username.');
    }

    if (normalized.includes('already')) {
        return t('This person is already in the circle.');
    }

    return t('Failed to invite member');
}

async function addMember(): Promise<void> {
    const id = memberForm.data.identifier.trim();

    if (!id) {
        return;
    }

    const isEmail = id.includes('@');
    const field: 'email' | 'username' = isEmail ? 'email' : 'username';

    memberForm.processing = true;
    memberForm.errors = {};

    try {
        await externalApi.post(`/circles/${circleId.value}/members`, {
            [field]: id,
        });
        memberForm.reset();
        inviteSent.value = true;
        setTimeout(() => {
            inviteSent.value = false;
        }, 3000);

        // Refetch circle om de bijgewerkte pending_invitations op te halen.
        try {
            const response = await externalApi.get<{ data: Circle }>(
                `/circles/${circleId.value}`,
            );
            invitations.value = response.data.pending_invitations ?? [];
        } catch {
            // ignore
        }
    } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
            memberForm.errors = {
                identifier: t(
                    'Too many invitations sent. Please try again later.',
                ),
            };
        } else if (error instanceof ApiError) {
            memberForm.errors = {
                identifier: friendlyInviteError(error, field),
            };
        } else {
            memberForm.errors = { identifier: t('Failed to invite member') };
        }
    } finally {
        memberForm.processing = false;
    }
}

async function pickPhoto(): Promise<void> {
    await Camera.pickImages().all();
}

async function handleMediaSelected(payload: {
    success: boolean;
    files: { path: string; mimeType: string }[];
    cancelled: boolean;
}): Promise<void> {
    if (
        !payload.success ||
        payload.cancelled ||
        !payload.files.length ||
        !circle.value
    ) {
        return;
    }

    try {
        await api.post(`/api/spa/circles/${circleId.value}/photo`, {
            photo_path: payload.files[0].path,
        });
        await loadData();
    } catch {
        // upload mislukt — blijft op huidige photo staan
    }
}

let pendingInvitationId: string | null = null;

async function cancelInvitation(invitationId: string): Promise<void> {
    pendingInvitationId = invitationId;
    await Dialog.alert()
        .confirm(
            t('Cancel invitation'),
            t('Are you sure you want to cancel this invitation?'),
        )
        .id('cancel-invitation-confirm');
}

let pendingMemberId: string | null = null;

async function removeMember(userId: string): Promise<void> {
    pendingMemberId = userId;
    await Dialog.alert()
        .confirm(
            t('Remove member'),
            t('Are you sure you want to remove this member?'),
        )
        .id('remove-member-confirm');
}

async function handleButtonPressed(payload: {
    index: number;
    label: string;
    id?: string | null;
}): Promise<void> {
    if (
        payload.id === 'cancel-invitation-confirm' &&
        payload.index === 1 &&
        pendingInvitationId
    ) {
        const id = pendingInvitationId;
        pendingInvitationId = null;
        // Optimistic: verwijder direct uit lijst, rollback bij fout.
        const previous = invitations.value;
        invitations.value = invitations.value.filter((i) => i.id !== id);

        try {
            await externalApi.delete(
                `/circles/${circleId.value}/invitations/${id}`,
            );
        } catch {
            invitations.value = previous;
        }
    }

    if (
        payload.id === 'remove-member-confirm' &&
        payload.index === 1 &&
        pendingMemberId
    ) {
        const id = pendingMemberId;
        pendingMemberId = null;

        if (!circle.value) {
            return;
        }

        // Optimistic: verwijder member direct uit lijst, rollback bij fout.
        const previousMembers = circle.value.members;
        const previousCount = circle.value.members_count;
        circle.value.members = (circle.value.members ?? []).filter(
            (m) => m.id !== id,
        );
        circle.value.members_count = Math.max(0, previousCount - 1);

        try {
            await externalApi.delete(
                `/circles/${circleId.value}/members/${id}`,
            );
        } catch {
            if (circle.value) {
                circle.value.members = previousMembers;
                circle.value.members_count = previousCount;
            }
        }
    }

    if (payload.id === 'leave-circle-confirm' && payload.index === 1) {
        isLeaving.value = true;

        try {
            await externalApi.post(`/circles/${circleId.value}/leave`);
            circlesStore.remove(circleId.value);
            router.push({ name: 'spa.circles.index' });
        } catch {
            // ignore — gebruiker blijft op de huidige kring
        } finally {
            isLeaving.value = false;
        }
    }

    if (payload.id === 'delete-circle-confirm' && payload.index === 1) {
        isDeleting.value = true;

        try {
            await externalApi.delete(`/circles/${circleId.value}`);
            circlesStore.remove(circleId.value);
            router.push({ name: 'spa.circles.index' });
        } catch {
            // ignore — kring blijft staan
        } finally {
            isDeleting.value = false;
        }
    }
}

onMounted(() => {
    On(Events.Alert.ButtonPressed, handleButtonPressed);
    On(Events.Gallery.MediaSelected, handleMediaSelected);
});

onUnmounted(() => {
    Off(Events.Alert.ButtonPressed, handleButtonPressed);
    Off(Events.Gallery.MediaSelected, handleMediaSelected);
});

function startEdit(): void {
    if (!circle.value) {
        return;
    }

    editForm.data.name = circle.value.name;
    isEditing.value = !isEditing.value;
}

function goBack(): void {
    router.push({ name: 'spa.circles.index' });
}

function maskStyle(icon: string) {
    return {
        maskImage: `url(${icon})`,
        WebkitMaskImage: `url(${icon})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
    };
}
</script>

<template>
    <AppLayout ref="layout" :title="circle?.name ?? t('Circle')">
        <template #header-left>
            <button class="text-teal" @click="goBack">
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
        <template #header-right>
            <div v-if="circle" class="flex items-center gap-2">
                <RouterLink
                    :to="{
                        name: 'spa.circles.map',
                        params: { circle: circle.id },
                    }"
                    class="flex size-9 items-center justify-center rounded-full bg-white/80 text-teal shadow-sm transition hover:bg-white"
                    :aria-label="t('Open map')"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke="currentColor"
                        class="size-4"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M9 6.75V15m0-8.25L3.32 4.507a.75.75 0 0 0-1.07.68v11.124c0 .285.165.544.421.666L9 19.5m0-12.75 6 3m-6 9 6-3m0 0V15m0-8.25 5.68-2.243a.75.75 0 0 1 1.07.68v11.124a.75.75 0 0 1-.421.666L15 19.5M15 6.75V15"
                        />
                    </svg>
                </RouterLink>
                <button
                    v-if="circle.is_owner"
                    class="flex size-9 items-center justify-center rounded-full bg-white/80 text-teal shadow-sm transition hover:bg-white"
                    :aria-label="t('Edit circle')"
                    data-tour="circle.permissions"
                    @click="startEdit"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke="currentColor"
                        class="size-4"
                    >
                        <path
                            v-if="!isEditing"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                        />
                        <path
                            v-else
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </template>

        <div class="relative mt-10 pb-24">
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div v-if="circle" class="relative space-y-4 px-4 pt-4 pb-24">
                <SurfaceCard>
                    <div class="text-center">
                        <button
                            class="relative mx-auto block"
                            :disabled="!circle.is_owner"
                            :aria-label="
                                circle.is_owner
                                    ? t('Change circle photo')
                                    : undefined
                            "
                            @click="circle.is_owner && pickPhoto()"
                        >
                            <img
                                v-if="circle.photo"
                                :src="circle.photo"
                                :alt="circle.name"
                                class="avatar-ring size-20 rounded-full object-cover shadow-sm"
                            />
                            <IconTile
                                v-else
                                :icon="userIcon"
                                size="lg"
                                tone="sage"
                                class="!size-20 !rounded-full"
                            />
                            <span
                                v-if="circle.is_owner"
                                class="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-teal shadow-md ring-4 ring-white/70"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="2"
                                    stroke="currentColor"
                                    class="size-4 text-white"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
                                    />
                                </svg>
                            </span>
                        </button>
                    </div>
                </SurfaceCard>

                <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="-translate-y-2 opacity-0"
                    enter-to-class="translate-y-0 opacity-100"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="translate-y-0 opacity-100"
                    leave-to-class="-translate-y-2 opacity-0"
                >
                    <SurfaceCard v-if="isEditing">
                        <h3 class="font-semibold text-teal">
                            {{ t('Circle name') }}
                        </h3>
                        <form
                            class="mt-3 space-y-3"
                            @submit.prevent="updateCircle"
                        >
                            <input
                                v-model="editForm.data.name"
                                type="text"
                                class="field"
                            />
                            <p
                                v-if="editForm.errors.name"
                                class="text-blush-500"
                            >
                                {{ editForm.errors.name }}
                            </p>
                            <div class="flex justify-end">
                                <Button
                                    type="submit"
                                    size="md"
                                    :disabled="
                                        editForm.processing ||
                                        !editForm.data.name.trim()
                                    "
                                >
                                    {{ t('Save') }}
                                </Button>
                            </div>
                        </form>

                        <div class="mt-5 border-t border-sand-100 pt-4">
                            <label
                                class="flex cursor-pointer items-center justify-between gap-3"
                            >
                                <span>
                                    <span
                                        class="block font-semibold text-teal"
                                        >{{
                                            t('Members can invite others')
                                        }}</span
                                    >
                                    <span class="block text-teal-muted">{{
                                        t(
                                            'Allow everyone in this circle to send invitations.',
                                        )
                                    }}</span>
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    :aria-checked="circle.members_can_invite"
                                    :class="
                                        circle.members_can_invite
                                            ? 'bg-brand-green'
                                            : 'bg-sand-300'
                                    "
                                    class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                                    @click="toggleMembersCanInvite"
                                >
                                    <span
                                        :class="
                                            circle.members_can_invite
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                        "
                                        class="pointer-events-none mt-1 size-6 rounded-full bg-white shadow transition-transform"
                                    />
                                </button>
                            </label>
                        </div>

                        <div class="mt-4 border-t border-sand-100 pt-4">
                            <label
                                class="flex cursor-pointer items-center justify-between gap-3"
                            >
                                <span>
                                    <span
                                        class="block font-semibold text-teal"
                                        >{{
                                            t('Members can view other members')
                                        }}</span
                                    >
                                    <span class="block text-teal-muted">{{
                                        t(
                                            'When off, members only see themselves and you.',
                                        )
                                    }}</span>
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    :aria-checked="
                                        circle.members_can_view_members
                                    "
                                    :class="
                                        circle.members_can_view_members
                                            ? 'bg-brand-green'
                                            : 'bg-sand-300'
                                    "
                                    class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                                    @click="toggleMembersCanViewMembers"
                                >
                                    <span
                                        :class="
                                            circle.members_can_view_members
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                        "
                                        class="pointer-events-none mt-1 size-6 rounded-full bg-white shadow transition-transform"
                                    />
                                </button>
                            </label>
                        </div>

                        <div class="mt-4 border-t border-sand-100 pt-4">
                            <label
                                class="flex cursor-pointer items-center justify-between gap-3"
                            >
                                <span>
                                    <span
                                        class="block font-semibold text-teal"
                                        >{{
                                            t('Members can download media')
                                        }}</span
                                    >
                                    <span class="block text-teal-muted">{{
                                        t(
                                            'Allow members to save photos and videos shared in this circle.',
                                        )
                                    }}</span>
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    :aria-checked="circle.members_can_download"
                                    :class="
                                        circle.members_can_download
                                            ? 'bg-brand-green'
                                            : 'bg-sand-300'
                                    "
                                    class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                                    @click="toggleMembersCanDownload"
                                >
                                    <span
                                        :class="
                                            circle.members_can_download
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                        "
                                        class="pointer-events-none mt-1 size-6 rounded-full bg-white shadow transition-transform"
                                    />
                                </button>
                            </label>
                        </div>
                    </SurfaceCard>
                </Transition>

                <SurfaceCard v-if="canInvite" data-tour="circle.invite">
                    <h3 class="font-semibold text-teal">
                        {{ t('Invite to this circle') }}
                    </h3>
                    <p class="mt-1 text-teal-muted">
                        {{ t('How would you like to invite people?') }}
                    </p>

                    <div
                        role="tablist"
                        class="mt-3 grid grid-cols-2 gap-1 rounded-full bg-sand-100 p-1"
                    >
                        <button
                            type="button"
                            role="tab"
                            :aria-selected="inviteMethod === 'identifier'"
                            :class="[
                                'rounded-full px-3 py-2 text-sm font-medium transition',
                                inviteMethod === 'identifier'
                                    ? 'bg-white text-teal shadow-sm'
                                    : 'text-teal-muted hover:text-teal',
                            ]"
                            @click="inviteMethod = 'identifier'"
                        >
                            {{ t('Username or email') }}
                        </button>
                        <button
                            type="button"
                            role="tab"
                            :aria-selected="inviteMethod === 'link'"
                            :class="[
                                'rounded-full px-3 py-2 text-sm font-medium transition',
                                inviteMethod === 'link'
                                    ? 'bg-white text-teal shadow-sm'
                                    : 'text-teal-muted hover:text-teal',
                            ]"
                            @click="inviteMethod = 'link'"
                        >
                            {{ t('Share a link') }}
                        </button>
                    </div>

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
                            v-if="inviteMethod === 'identifier' && inviteSent"
                            key="sent"
                            class="mt-4 flex items-center gap-2 rounded-lg bg-sage-100/70 px-4 py-3 text-sage-700"
                        >
                            <IconTile
                                :icon="sendIcon"
                                size="sm"
                                tone="sage"
                                class="!size-8"
                            />
                            {{ t('Invitation sent!') }}
                        </div>
                        <form
                            v-else-if="inviteMethod === 'identifier'"
                            key="form"
                            class="mt-4 space-y-3"
                            @submit.prevent="addMember"
                        >
                            <input
                                :value="memberForm.data.identifier"
                                type="text"
                                :placeholder="t('Username or email...')"
                                class="field"
                                @input="
                                    memberForm.data.identifier = (
                                        $event.target as HTMLInputElement
                                    ).value.toLowerCase()
                                "
                            />
                            <p
                                v-if="memberForm.errors.identifier"
                                class="text-blush-500"
                            >
                                {{ memberForm.errors.identifier }}
                            </p>
                            <div class="flex justify-end">
                                <Button
                                    type="submit"
                                    size="md"
                                    :disabled="
                                        memberForm.processing ||
                                        !memberForm.data.identifier.trim()
                                    "
                                >
                                    {{ t('Invite') }}
                                </Button>
                            </div>
                        </form>
                        <div v-else key="link" class="mt-4">
                            <ShareInviteLinkSection
                                :circle-id="circle.id"
                                :circle-name="circle.name"
                            />
                        </div>
                    </Transition>
                </SurfaceCard>

                <SurfaceCard
                    v-if="canSeeMembers && members.length > 0"
                    data-tour="circle.members"
                >
                    <h3 class="font-semibold text-teal">
                        {{ t('Members') }}
                    </h3>
                    <ul class="mt-3 divide-y divide-sand-100">
                        <li
                            v-for="member in members"
                            :key="member.id"
                            class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                            <RouterLink
                                :to="{
                                    name: 'spa.profiles.show',
                                    params: { username: member.username },
                                }"
                                class="flex min-w-0 flex-1 items-center gap-3"
                            >
                                <img
                                    :src="
                                        member.avatar ??
                                        `https://ui-avatars.com/api/?name=${member.name}&background=f0dcc6&color=5c3f24&size=64`
                                    "
                                    :alt="member.name"
                                    class="avatar-ring size-11 shrink-0 rounded-full object-cover"
                                />
                                <div class="min-w-0 flex-1">
                                    <p class="truncate font-semibold text-teal">
                                        {{ member.name }}
                                    </p>
                                    <p class="truncate text-teal-muted">
                                        @{{ member.username }}
                                    </p>
                                </div>
                            </RouterLink>
                            <span
                                v-if="member.is_owner"
                                :title="t('Owner')"
                                class="inline-flex items-center gap-1 rounded-full bg-accent-soft/30 px-2.5 py-1 text-accent"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-3.5 bg-current"
                                    :style="maskStyle(crownIcon)"
                                ></span>
                                {{ t('Owner') }}
                            </span>
                            <button
                                v-else-if="circle.is_owner"
                                class="flex size-9 items-center justify-center rounded-lg text-teal-muted transition hover:bg-blush-50 hover:text-blush-500"
                                :aria-label="t('Remove member')"
                                @click="removeMember(member.id)"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-5 bg-current"
                                    :style="maskStyle(userRemoveIcon)"
                                ></span>
                            </button>
                        </li>
                    </ul>
                </SurfaceCard>

                <SurfaceCard v-if="canSeeMembers && invitations.length > 0">
                    <h3 class="flex items-center gap-3 font-semibold text-teal">
                        <IconTile :icon="mailIcon" size="sm" tone="sage" />
                        {{ t('Pending invitations') }}
                    </h3>
                    <ul class="mt-3 divide-y divide-sand-100">
                        <li
                            v-for="invitation in invitations"
                            :key="invitation.id"
                            class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                            <IconTile :icon="mailIcon" size="sm" tone="sand" />
                            <div class="min-w-0 flex-1">
                                <p class="truncate font-semibold text-teal">
                                    {{
                                        invitation.username
                                            ? `@${invitation.username}`
                                            : invitation.email
                                    }}
                                </p>
                                <p class="text-teal-muted">
                                    {{ t('Pending') }}
                                </p>
                            </div>
                            <button
                                class="flex size-9 items-center justify-center rounded-lg text-teal-muted transition hover:bg-blush-50 hover:text-blush-500"
                                :aria-label="t('Cancel invitation')"
                                @click="cancelInvitation(invitation.id)"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="2"
                                    stroke="currentColor"
                                    class="size-4"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M6 18 18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </li>
                    </ul>
                </SurfaceCard>

                <SurfaceCard
                    v-if="members.length === 0 && invitations.length === 0"
                >
                    <div
                        class="flex flex-col items-center px-2 py-4 text-center"
                    >
                        <IconTile
                            :icon="userAddIcon"
                            size="lg"
                            tone="sage"
                            class="mb-4"
                        />
                        <h3 class="font-sans text-lg font-semibold text-teal">
                            {{ t('No members yet') }}
                        </h3>
                        <p class="mt-1 text-teal-muted">
                            {{
                                t(
                                    'Add people by their username or invite them by email.',
                                )
                            }}
                        </p>
                    </div>
                </SurfaceCard>

                <div class="space-y-3 pt-2">
                    <Button
                        v-if="circle.is_owner && members.length > 1"
                        variant="secondary"
                        size="lg"
                        block
                        :to="{
                            name: 'spa.circles.transfer-ownership',
                            params: { circle: circle.id },
                        }"
                    >
                        {{ t('Transfer ownership') }}
                    </Button>
                    <Button
                        v-if="!circle.is_owner"
                        variant="danger"
                        size="lg"
                        block
                        :disabled="isLeaving"
                        @click="leaveCircle"
                    >
                        {{ isLeaving ? t('Leaving...') : t('Leave circle') }}
                    </Button>
                    <Button
                        v-else
                        variant="danger"
                        size="lg"
                        block
                        :disabled="isDeleting"
                        @click="deleteCircle"
                    >
                        {{ isDeleting ? t('Deleting...') : t('Delete circle') }}
                    </Button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
