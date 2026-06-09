<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { trackOnboardingStep } from '@/spa/http/onboarding';
import shieldIcon from '../../../../svg/doodle-icons/shield.svg';

interface Circle {
    id: string;
    name: string;
    members_can_invite: boolean;
    members_can_view_members: boolean;
    members_can_download: boolean;
}

const { t } = useTranslations();
const route = useRoute();
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

const circle = ref<Circle | null>(null);
const membersCanInvite = ref(true);
const membersCanViewMembers = ref(true);
const membersCanDownload = ref(true);
const processing = ref(false);

const circleId = String(route.params.circle);

onMounted(async () => {
    try {
        const data = await externalApi.get<{ data: Circle }>(
            `/circles/${circleId}`,
        );
        circle.value = data.data;
        membersCanInvite.value = data.data.members_can_invite;
        membersCanViewMembers.value = data.data.members_can_view_members;
        membersCanDownload.value = data.data.members_can_download;
    } catch {
        router.push({ name: 'spa.onboarding.first-circle' });
    }
});

async function continueOnboarding(): Promise<void> {
    processing.value = true;

    try {
        await externalApi.put(`/circles/${circleId}/settings`, {
            members_can_invite: membersCanInvite.value,
            members_can_view_members: membersCanViewMembers.value,
            members_can_download: membersCanDownload.value,
        });
    } catch {
        // Permissions kunnen later alsnog vanuit de kring-instellingen
        // aangepast worden; we blokkeren de onboarding niet bij netwerkfout.
    } finally {
        processing.value = false;
    }

    trackOnboardingStep('circle_permissions');
    router.push({
        name: 'spa.onboarding.add-children',
        params: { circle: circleId },
    });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-ink"
    >
        <div class="relative flex flex-1 flex-col py-12">
            <div class="mb-8 text-center">
                <span
                    class="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success-ink shadow-sm"
                >
                    {{ circle?.name ?? ' ' }}
                </span>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-ink"
                >
                    {{ t('Set the rules') }}
                </h1>
                <p class="mt-3 text-ink-muted">
                    {{
                        t(
                            'Decide what members of this circle are allowed to do. You can change this later.',
                        )
                    }}
                </p>
            </div>

            <div class="w-full max-w-sm space-y-4 self-center">
                <div
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <label
                        class="flex cursor-pointer items-start justify-between gap-3"
                    >
                        <span class="flex items-start gap-3">
                            <span
                                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-ink"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-6 bg-current"
                                    :style="iconMaskStyle(shieldIcon)"
                                ></span>
                            </span>
                            <span>
                                <span class="block font-semibold text-ink">
                                    {{ t('Members can invite others') }}
                                </span>
                                <span class="mt-0.5 block text-ink-muted">
                                    {{
                                        t(
                                            'Allow everyone in this circle to send invitations.',
                                        )
                                    }}
                                </span>
                            </span>
                        </span>
                        <button
                            type="button"
                            role="switch"
                            :aria-checked="membersCanInvite"
                            :class="
                                membersCanInvite
                                    ? 'bg-brand-green'
                                    : 'bg-sand-300'
                            "
                            class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
                            @click="membersCanInvite = !membersCanInvite"
                        >
                            <span
                                :class="
                                    membersCanInvite
                                        ? 'translate-x-7'
                                        : 'translate-x-1'
                                "
                                class="pointer-events-none mt-1 size-6 rounded-full bg-surface shadow transition-transform"
                            />
                        </button>
                    </label>
                </div>

                <div
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <label
                        class="flex cursor-pointer items-start justify-between gap-3"
                    >
                        <span class="flex items-start gap-3">
                            <span
                                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-ink"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-6 bg-current"
                                    :style="iconMaskStyle(shieldIcon)"
                                ></span>
                            </span>
                            <span>
                                <span class="block font-semibold text-ink">
                                    {{ t('Members can view other members') }}
                                </span>
                                <span class="mt-0.5 block text-ink-muted">
                                    {{
                                        t(
                                            'When off, members only see themselves and you.',
                                        )
                                    }}
                                </span>
                            </span>
                        </span>
                        <button
                            type="button"
                            role="switch"
                            :aria-checked="membersCanViewMembers"
                            :class="
                                membersCanViewMembers
                                    ? 'bg-brand-green'
                                    : 'bg-sand-300'
                            "
                            class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
                            @click="
                                membersCanViewMembers = !membersCanViewMembers
                            "
                        >
                            <span
                                :class="
                                    membersCanViewMembers
                                        ? 'translate-x-7'
                                        : 'translate-x-1'
                                "
                                class="pointer-events-none mt-1 size-6 rounded-full bg-surface shadow transition-transform"
                            />
                        </button>
                    </label>
                </div>

                <div
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <label
                        class="flex cursor-pointer items-start justify-between gap-3"
                    >
                        <span class="flex items-start gap-3">
                            <span
                                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-ink"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-6 bg-current"
                                    :style="iconMaskStyle(shieldIcon)"
                                ></span>
                            </span>
                            <span>
                                <span class="block font-semibold text-ink">
                                    {{ t('Members can download media') }}
                                </span>
                                <span class="mt-0.5 block text-ink-muted">
                                    {{
                                        t(
                                            'Allow members to save photos and videos shared in this circle.',
                                        )
                                    }}
                                </span>
                            </span>
                        </span>
                        <button
                            type="button"
                            role="switch"
                            :aria-checked="membersCanDownload"
                            :class="
                                membersCanDownload
                                    ? 'bg-brand-green'
                                    : 'bg-sand-300'
                            "
                            class="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
                            @click="membersCanDownload = !membersCanDownload"
                        >
                            <span
                                :class="
                                    membersCanDownload
                                        ? 'translate-x-7'
                                        : 'translate-x-1'
                                "
                                class="pointer-events-none mt-1 size-6 rounded-full bg-surface shadow transition-transform"
                            />
                        </button>
                    </label>
                </div>
            </div>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="w-full rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:opacity-40"
                :disabled="processing || !circle"
                @click="continueOnboarding"
            >
                {{ processing ? t('Saving...') : t('Continue') }}
            </button>
        </div>
    </div>
</template>
