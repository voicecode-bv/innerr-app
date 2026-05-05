<script setup lang="ts">
import { Dialog, Events, Off, On } from '@nativephp/mobile';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import IconTile from '@/components/IconTile.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import arrowCircleRightIcon from '../../../../svg/doodle-icons/arrow-circle-right.svg';
import crownIcon from '../../../../svg/doodle-icons/crown.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

interface Member {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    is_owner: boolean;
}

interface Circle {
    id: string;
    name: string;
    photo: string | null;
    members: Member[] | null;
    is_owner: boolean;
}

interface TransferUser {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
}

interface PendingTransfer {
    id: string;
    created_at: string;
    from_user: TransferUser;
    to_user: TransferUser;
}

const { t } = useTranslations();
const route = useRoute();
const router = useRouter();

const circleId = computed(() => String(route.params.circle));

const circle = ref<Circle | null>(null);
const pendingTransfer = ref<PendingTransfer | null>(null);

async function loadData(): Promise<void> {
    try {
        const [circleResp, transfersResp] = await Promise.all([
            externalApi.get<{ data: Circle }>(`/circles/${circleId.value}`),
            externalApi
                .get<{
                    data: PendingTransfer[];
                }>(`/circles/${circleId.value}/ownership-transfers`)
                .catch(() => ({ data: [] as PendingTransfer[] })),
        ]);
        circle.value = circleResp.data;
        pendingTransfer.value = transfersResp.data[0] ?? null;
    } catch {
        router.push({ name: 'spa.circles.index' });
    }
}

onMounted(loadData);

const selectedMemberId = ref<string | null>(null);

const eligibleMembers = computed(() =>
    (circle.value?.members ?? []).filter((m) => !m.is_owner),
);

const selectedMember = computed(
    () =>
        eligibleMembers.value.find((m) => m.id === selectedMemberId.value) ??
        null,
);

const formProcessing = ref(false);
const formError = ref<string | null>(null);

function goBack(): void {
    if (circle.value) {
        router.push({
            name: 'spa.circles.show',
            params: { circle: circle.value.id },
        });
    } else {
        router.push({ name: 'spa.circles.index' });
    }
}

async function confirmTransfer(): Promise<void> {
    if (!selectedMember.value) return;

    await Dialog.alert()
        .confirm(
            t('Transfer ownership'),
            t('Are you sure you want to transfer ownership to :name?', {
                name: selectedMember.value.name,
            }),
        )
        .id('transfer-ownership-confirm');
}

async function cancelTransfer(): Promise<void> {
    await Dialog.alert()
        .confirm(
            t('Cancel transfer'),
            t('Are you sure you want to cancel this ownership transfer?'),
        )
        .id('cancel-transfer-confirm');
}

async function handleButtonPressed(payload: {
    index: number;
    label: string;
    id?: string | null;
}): Promise<void> {
    if (
        payload.id === 'transfer-ownership-confirm' &&
        payload.index === 1 &&
        selectedMemberId.value
    ) {
        formProcessing.value = true;
        formError.value = null;
        try {
            await externalApi.post(
                `/circles/${circleId.value}/ownership-transfer`,
                {
                    user_id: selectedMemberId.value,
                },
            );
            selectedMemberId.value = null;
            await loadData();
        } catch (error) {
            formError.value =
                (error as Error).message ?? t('Failed to start transfer');
        } finally {
            formProcessing.value = false;
        }
    }
    if (
        payload.id === 'cancel-transfer-confirm' &&
        payload.index === 1 &&
        pendingTransfer.value
    ) {
        try {
            await externalApi.delete(
                `/circles/${circleId.value}/ownership-transfer/${pendingTransfer.value.id}`,
            );
            await loadData();
        } catch {
            // ignore
        }
    }
}

onMounted(() => {
    On(Events.Alert.ButtonPressed, handleButtonPressed);
});

onUnmounted(() => {
    Off(Events.Alert.ButtonPressed, handleButtonPressed);
});
</script>

<template>
    <AppLayout :title="t('Transfer ownership')">
        <template #header-left>
            <button class="text-teal dark:text-sand-300" @click="goBack">
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

        <div class="relative mt-10 pb-24">
            <div class="relative space-y-4 px-4 pt-4 pb-24">
                <SurfaceCard>
                    <div class="flex items-start gap-3">
                        <IconTile
                            :icon="arrowCircleRightIcon"
                            size="md"
                            tone="accent"
                        />
                        <div class="min-w-0">
                            <h2
                                class="font-sans text-lg font-semibold text-teal dark:text-sand-100"
                            >
                                {{ t('Transfer ownership') }}
                            </h2>
                            <p class="mt-1 text-sand-600 dark:text-sand-400">
                                {{
                                    t(
                                        'Choose a member to transfer ownership of this circle to. They must accept before the transfer is complete.',
                                    )
                                }}
                            </p>
                        </div>
                    </div>
                </SurfaceCard>

                <SurfaceCard v-if="pendingTransfer">
                    <h3
                        class="flex items-center gap-3 font-semibold text-sand-900 dark:text-sand-100"
                    >
                        <IconTile
                            :icon="arrowCircleRightIcon"
                            size="sm"
                            tone="sand"
                        />
                        {{ t('Pending transfer') }}
                    </h3>
                    <div
                        class="my-4 flex items-center gap-3 rounded-xl bg-sand-50/80 p-3 dark:bg-sand-800/40"
                    >
                        <img
                            :src="
                                pendingTransfer.to_user.avatar ??
                                `https://ui-avatars.com/api/?name=${pendingTransfer.to_user.name}&background=f0dcc6&color=5c3f24&size=64`
                            "
                            :alt="pendingTransfer.to_user.name"
                            class="size-11 shrink-0 rounded-full object-cover"
                        />
                        <div class="min-w-0 flex-1">
                            <p
                                class="truncate font-semibold text-sand-900 dark:text-sand-100"
                            >
                                {{ pendingTransfer.to_user.name }}
                            </p>
                            <p
                                class="truncate text-sand-500 dark:text-sand-400"
                            >
                                @{{ pendingTransfer.to_user.username }}
                            </p>
                        </div>
                    </div>
                    <Button variant="danger" size="sm" @click="cancelTransfer">
                        {{ t('Cancel transfer') }}
                    </Button>
                </SurfaceCard>

                <SurfaceCard v-else-if="eligibleMembers.length > 0">
                    <h3
                        class="flex items-center gap-3 font-semibold text-sand-900 dark:text-sand-100"
                    >
                        <IconTile :icon="crownIcon" size="sm" tone="sage" />
                        {{ t('Select a new owner') }}
                    </h3>
                    <ul class="mt-4 space-y-2">
                        <li v-for="member in eligibleMembers" :key="member.id">
                            <button
                                type="button"
                                class="flex w-full items-center gap-3 rounded-xl p-3 text-left transition"
                                :class="
                                    selectedMemberId === member.id
                                        ? 'bg-sage-100/60 dark:bg-sage-800/30'
                                        : 'hover:bg-sand-50 dark:hover:bg-sand-800/40'
                                "
                                @click="selectedMemberId = member.id"
                            >
                                <img
                                    :src="
                                        member.avatar ??
                                        `https://ui-avatars.com/api/?name=${member.name}&background=f0dcc6&color=5c3f24&size=64`
                                    "
                                    :alt="member.name"
                                    class="size-11 shrink-0 rounded-full object-cover"
                                />
                                <div class="min-w-0 flex-1">
                                    <p
                                        class="truncate font-semibold text-sand-900 dark:text-sand-100"
                                    >
                                        {{ member.name }}
                                    </p>
                                    <p
                                        class="truncate text-sand-500 dark:text-sand-400"
                                    >
                                        @{{ member.username }}
                                    </p>
                                </div>
                                <span
                                    class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition"
                                    :class="
                                        selectedMemberId === member.id
                                            ? 'border-teal bg-teal'
                                            : 'border-sand-300 dark:border-sand-600'
                                    "
                                >
                                    <svg
                                        v-if="selectedMemberId === member.id"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="3"
                                        stroke="currentColor"
                                        class="size-3.5 text-white"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="m4.5 12.75 6 6 9-13.5"
                                        />
                                    </svg>
                                </span>
                            </button>
                        </li>
                    </ul>
                    <p v-if="formError" class="mt-2 text-accent">
                        {{ formError }}
                    </p>
                    <div class="mt-5 flex justify-end">
                        <Button
                            size="md"
                            :disabled="!selectedMember || formProcessing"
                            @click="confirmTransfer"
                        >
                            {{ t('Transfer ownership') }}
                        </Button>
                    </div>
                </SurfaceCard>

                <SurfaceCard v-else>
                    <div
                        class="flex flex-col items-center px-2 py-4 text-center"
                    >
                        <IconTile
                            :icon="userIcon"
                            size="lg"
                            tone="sage"
                            class="mb-4"
                        />
                        <h3
                            class="font-sans text-lg font-semibold text-teal dark:text-sand-100"
                        >
                            {{ t('No members to transfer to') }}
                        </h3>
                        <p class="mt-1 text-sand-600 dark:text-sand-400">
                            {{
                                t(
                                    'Invite someone to this circle first, then you can transfer ownership.',
                                )
                            }}
                        </p>
                    </div>
                </SurfaceCard>
            </div>
        </div>
    </AppLayout>
</template>
