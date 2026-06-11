<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Spinner from '@/components/Spinner.vue';
import OnboardingHeader from '@/spa/components/OnboardingHeader.vue';
import ShareInviteLinkSection from '@/spa/components/ShareInviteLinkSection.vue';
import { useApiForm } from '@/spa/composables/useApiForm';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import { trackOnboardingStep } from '@/spa/http/onboarding';
import userAddIcon from '../../../../svg/doodle-icons/user-add.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

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
const invited = ref<string[]>([]);
// Sharing or copying the invite link counts as a completed invite action for
// the footer label, even though we cannot see who the link reaches.
const hasSharedLink = ref(false);
const form = useApiForm({ identifier: '' });

// Circle rules, folded into this step so inviting and what invitees may do
// live on one screen. Saved on continue; defaults mirror the server values.
const membersCanInvite = ref(true);
const membersCanViewMembers = ref(true);
const membersCanDownload = ref(true);
const processing = ref(false);

const circleId = String(route.params.circle);
const circleLoadFailed = ref(false);

// The link card and the rules card need the circle; the identifier form works
// off the route param alone. A fetch failure therefore shows a retry state
// for those cards instead of silently skipping the whole step.
async function loadCircle(): Promise<void> {
    circleLoadFailed.value = false;

    try {
        const data = await externalApi.get<{ data: Circle }>(
            `/circles/${circleId}`,
        );
        circle.value = data.data;
        membersCanInvite.value = data.data.members_can_invite;
        membersCanViewMembers.value = data.data.members_can_view_members;
        membersCanDownload.value = data.data.members_can_download;
    } catch {
        circleLoadFailed.value = true;
    }
}

onMounted(loadCircle);

function friendlyApiError(
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

async function submit(): Promise<void> {
    const id = form.data.identifier.trim();

    if (!id) {
        return;
    }

    const isEmail = id.includes('@');
    const field: 'email' | 'username' = isEmail ? 'email' : 'username';

    form.processing = true;
    form.errors = {};

    try {
        await externalApi.post(`/circles/${circleId}/members`, { [field]: id });

        if (!invited.value.includes(id)) {
            invited.value = [id, ...invited.value];
        }

        form.data.identifier = '';
    } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
            form.errors = {
                identifier: t(
                    'Too many invitations sent. Please try again later.',
                ),
            };
        } else if (error instanceof ApiError) {
            form.errors = { identifier: friendlyApiError(error, field) };
        } else {
            form.errors = { identifier: t('Failed to invite member') };
        }
    } finally {
        form.processing = false;
    }
}

async function continueOnboarding(): Promise<void> {
    processing.value = true;

    try {
        await externalApi.put(`/circles/${circleId}/settings`, {
            members_can_invite: membersCanInvite.value,
            members_can_view_members: membersCanViewMembers.value,
            members_can_download: membersCanDownload.value,
        });
    } catch {
        // Rules can still be changed from the circle settings later; a
        // network error must not block the onboarding.
    } finally {
        processing.value = false;
    }

    trackOnboardingStep('invite_members');
    router.push({ name: 'spa.onboarding.notifications' });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-ink"
    >
        <OnboardingHeader
            :step="2"
            :back-to="{
                name: 'spa.onboarding.add-children',
                params: { circle: circleId },
            }"
        />
        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-10 text-center">
                <span
                    class="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success-ink shadow-sm"
                >
                    {{ circle?.name ?? ' ' }}
                </span>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-ink"
                >
                    {{ t('Invite your people') }}
                </h1>
                <p class="mt-3 text-ink-muted">
                    {{
                        t(
                            'Add family or friends to this circle. They will be able to see what you share.',
                        )
                    }}
                </p>
            </div>

            <div class="w-full max-w-sm space-y-5">
                <!-- Primary: share a link. Grandparents and friends usually do
                     not have an account yet, so this is the path that works
                     for everyone; the identifier form below is the fallback
                     for people already on innerr. -->
                <div
                    v-if="circleLoadFailed"
                    class="rounded-lg bg-surface/50 p-5 text-center shadow-sm backdrop-blur-sm"
                >
                    <p class="text-ink-muted">
                        {{ t('Could not load your circle.') }}
                    </p>
                    <button
                        type="button"
                        class="mt-3 rounded-full bg-action px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-action-hover"
                        @click="loadCircle"
                    >
                        {{ t('Try again') }}
                    </button>
                </div>

                <div
                    v-if="circle"
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <p class="tracking-wider text-ink-muted uppercase">
                        {{ t('Share an invite link') }}
                    </p>
                    <p class="mt-1 mb-4 text-ink-muted">
                        {{ t('Works for family who do not have the app yet.') }}
                    </p>
                    <ShareInviteLinkSection
                        :circle-id="circleId"
                        :circle-name="circle.name"
                        eager
                        @shared="hasSharedLink = true"
                    />
                </div>

                <div
                    v-if="circle"
                    class="flex items-center gap-3"
                    aria-hidden="true"
                >
                    <span class="h-px flex-1 bg-sand-200"></span>
                    <span
                        class="text-xs tracking-wider text-ink-muted uppercase"
                    >
                        {{ t('or') }}
                    </span>
                    <span class="h-px flex-1 bg-sand-200"></span>
                </div>

                <form
                    class="relative rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                    @submit.prevent="submit"
                >
                    <label
                        for="invite-identifier"
                        class="tracking-wider text-ink-muted uppercase"
                    >
                        {{ t('Username or email') }}
                    </label>
                    <div class="mt-3 flex items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-soft text-ink"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-6 bg-current"
                                :style="iconMaskStyle(userAddIcon)"
                            ></span>
                        </div>
                        <input
                            id="invite-identifier"
                            v-model="form.data.identifier"
                            type="text"
                            :placeholder="t('Username or email...')"
                            autocapitalize="none"
                            autocomplete="off"
                            class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink placeholder-ink-muted/50 focus:ring-0 focus:outline-none"
                        />
                        <button
                            type="submit"
                            :aria-label="t('Add')"
                            :disabled="
                                !form.data.identifier.trim() || form.processing
                            "
                            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-action text-white shadow-sm transition hover:bg-action-hover disabled:opacity-40"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="2.5"
                                stroke="currentColor"
                                class="size-5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M12 4.5v15m7.5-7.5h-15"
                                />
                            </svg>
                        </button>
                    </div>
                    <p
                        v-if="form.errors.identifier"
                        class="mt-2 text-destructive-ink"
                    >
                        {{ form.errors.identifier }}
                    </p>
                </form>

                <div v-if="invited.length > 0">
                    <div class="mb-3 flex items-center justify-between">
                        <p class="tracking-wider text-ink-muted uppercase">
                            {{ t('Invited') }}
                        </p>
                        <span
                            class="inline-flex size-6 items-center justify-center rounded-full bg-action leading-none font-semibold text-white shadow-sm"
                        >
                            {{ invited.length }}
                        </span>
                    </div>
                    <ul class="space-y-2">
                        <li
                            v-for="identifier in invited"
                            :key="identifier"
                            class="flex items-center gap-3 rounded-full bg-surface/70 px-4 py-2.5 shadow-sm"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-5 shrink-0 bg-action"
                                :style="iconMaskStyle(userIcon)"
                            ></span>
                            <span class="truncate text-ink">{{
                                identifier
                            }}</span>
                        </li>
                    </ul>
                </div>

                <!-- Circle rules, folded into the invite step: deciding what
                     members may do belongs right where they are invited. -->
                <div
                    v-if="circle"
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <p class="tracking-wider text-ink-muted uppercase">
                        {{ t('What members can do') }}
                    </p>
                    <div class="mt-3 space-y-3">
                        <label
                            class="flex cursor-pointer items-center justify-between gap-3"
                        >
                            <span class="text-ink">
                                {{ t('Members can invite others') }}
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
                                class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
                                @click="membersCanInvite = !membersCanInvite"
                            >
                                <span
                                    :class="
                                        membersCanInvite
                                            ? 'translate-x-6'
                                            : 'translate-x-1'
                                    "
                                    class="pointer-events-none mt-1 size-5 rounded-full bg-surface shadow transition-transform"
                                />
                            </button>
                        </label>
                        <label
                            class="flex cursor-pointer items-center justify-between gap-3"
                        >
                            <span class="text-ink">
                                {{ t('Members can view other members') }}
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
                                class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
                                @click="
                                    membersCanViewMembers =
                                        !membersCanViewMembers
                                "
                            >
                                <span
                                    :class="
                                        membersCanViewMembers
                                            ? 'translate-x-6'
                                            : 'translate-x-1'
                                    "
                                    class="pointer-events-none mt-1 size-5 rounded-full bg-surface shadow transition-transform"
                                />
                            </button>
                        </label>
                        <label
                            class="flex cursor-pointer items-center justify-between gap-3"
                        >
                            <span class="text-ink">
                                {{ t('Members can download media') }}
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
                                class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
                                @click="
                                    membersCanDownload = !membersCanDownload
                                "
                            >
                                <span
                                    :class="
                                        membersCanDownload
                                            ? 'translate-x-6'
                                            : 'translate-x-1'
                                    "
                                    class="pointer-events-none mt-1 size-5 rounded-full bg-surface shadow transition-transform"
                                />
                            </button>
                        </label>
                    </div>
                    <p class="mt-3 text-ink-muted">
                        {{ t('You can change this later.') }}
                    </p>
                </div>
            </div>
        </div>

        <!-- Skipping is a text link, not a primary button: filling the step
             in should look more attractive than skipping it. -->
        <div class="relative pt-2 pb-8">
            <button
                v-if="invited.length > 0 || hasSharedLink"
                class="flex w-full items-center justify-center gap-2 rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="processing"
                @click="continueOnboarding"
            >
                <Spinner v-if="processing" class="size-4" />
                <span>{{ t('Continue') }}</span>
                <span
                    v-if="invited.length > 0"
                    class="inline-flex size-5 items-center justify-center rounded-full bg-surface/20 leading-none font-semibold"
                >
                    {{ invited.length }}
                </span>
            </button>
            <button
                v-else
                class="flex w-full items-center justify-center gap-2 py-3.5 font-medium text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="processing"
                @click="continueOnboarding"
            >
                <Spinner v-if="processing" class="size-4" />
                {{ t('Invite later') }}
            </button>
        </div>
    </div>
</template>
