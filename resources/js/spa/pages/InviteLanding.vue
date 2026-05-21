<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import {
    acceptInviteLink,
    fetchInviteLinkPreview,
} from '@/spa/services/inviteLinks';
import type { InviteLinkPreview } from '@/spa/services/inviteLinks';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
import { useInviteIntentStore } from '@/spa/stores/inviteIntent';
import linkIcon from '../../../svg/doodle-icons/link.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

const userIconMaskStyle = {
    maskImage: `url(${userIcon})`,
    WebkitMaskImage: `url(${userIcon})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
};

const { t } = useTranslations();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const circles = useCirclesStore();
const inviteIntent = useInviteIntentStore();

const token = String(route.params.token ?? '');

const preview = ref<InviteLinkPreview | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const accepting = ref(false);
const acceptError = ref<string | null>(null);

function reasonMessage(reason: InviteLinkPreview['reason']): string {
    switch (reason) {
        case 'expired':
            return t('This invite link has expired.');
        case 'revoked':
            return t('This invite link has been revoked.');
        case 'maxed':
            return t('This invite link has reached its maximum uses.');
        default:
            return t('This invite link is no longer valid.');
    }
}

async function load(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
        preview.value = await fetchInviteLinkPreview(token);
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
            error.value = t('This invite link does not exist.');
        } else {
            error.value = t('Could not load this invitation.');
        }
    } finally {
        loading.value = false;
    }
}

async function join(): Promise<void> {
    if (!preview.value?.valid || accepting.value) {
        return;
    }

    accepting.value = true;
    acceptError.value = null;

    try {
        const result = await acceptInviteLink(token);
        inviteIntent.clear();
        circles.invalidate();
        await circles.refresh();
        await router.replace(`/circles/${result.circle.id}`);
    } catch (e) {
        if (e instanceof ApiError && e.status === 410) {
            acceptError.value = t('This invite link is no longer valid.');
            await load();
        } else {
            acceptError.value = t('Could not join the circle. Try again.');
        }
    } finally {
        accepting.value = false;
    }
}

function goToRegister(): void {
    inviteIntent.remember(token);
    void router.push({
        name: 'spa.register',
        query: { invite: token },
    });
}

function goToLogin(): void {
    inviteIntent.remember(token);
    void router.push({
        name: 'spa.login',
        query: { invite: token },
    });
}

onMounted(() => {
    void load();
});
</script>

<template>
    <div
        class="nativephp-safe-area flex min-h-dvh flex-col bg-brand-blue px-6 py-10"
    >
        <div v-if="loading" class="flex flex-1 items-center justify-center">
            <LoadingSpinner />
        </div>

        <div
            v-else-if="error"
            class="flex flex-1 flex-col items-center justify-center text-center"
        >
            <p class="text-brand-sand">{{ error }}</p>
            <Button class="mt-6" variant="inverse" @click="router.replace('/')">
                {{ t('Go home') }}
            </Button>
        </div>

        <div
            v-else-if="preview && !preview.valid"
            class="flex flex-1 flex-col items-center justify-center text-center"
        >
            <img
                :src="linkIcon"
                alt=""
                class="mb-4 size-16 opacity-70"
                aria-hidden="true"
            />
            <h1 class="text-2xl font-semibold text-brand-sand">
                {{ t('Invitation unavailable') }}
            </h1>
            <p class="mt-3 text-brand-sand/80">
                {{ reasonMessage(preview.reason) }}
            </p>
            <Button class="mt-8" variant="inverse" @click="router.replace('/')">
                {{ t('Go home') }}
            </Button>
        </div>

        <div
            v-else-if="preview"
            class="flex flex-1 flex-col items-center justify-center text-center"
        >
            <img
                v-if="preview.circle.photo"
                :src="preview.circle.photo"
                :alt="preview.circle.name"
                class="avatar-ring size-24 rounded-full object-cover"
            />
            <div
                v-else
                class="avatar-ring flex size-24 items-center justify-center rounded-full bg-brand-sand/15"
                aria-hidden="true"
            >
                <span
                    class="inline-block size-12 bg-brand-sand/80"
                    :style="userIconMaskStyle"
                ></span>
            </div>

            <p class="mt-6 text-brand-sand/80">
                {{
                    t(':name invites you to join', {
                        name: preview.inviter.name,
                    })
                }}
            </p>
            <h1 class="mt-1 text-3xl font-semibold text-brand-sand">
                {{ preview.circle.name }}
            </h1>

            <div
                v-if="preview.member_preview.length > 0"
                class="mt-6 flex flex-col items-center"
            >
                <div class="flex -space-x-3">
                    <img
                        v-for="member in preview.member_preview"
                        :key="member.name"
                        :src="
                            member.avatar ??
                            `https://ui-avatars.com/api/?name=${member.name}&background=f0dcc6&color=5c3f24&size=64`
                        "
                        :alt="member.name"
                        class="size-10 rounded-full border-2 border-brand-blue bg-brand-sand object-cover"
                    />
                </div>
                <p class="mt-3 text-brand-sand/80">
                    {{
                        preview.circle.members_count > 1
                            ? t(':count members', {
                                  count: preview.circle.members_count,
                              })
                            : t(':count member', {
                                  count: preview.circle.members_count,
                              })
                    }}
                </p>
            </div>

            <p
                v-if="acceptError"
                class="mt-6 rounded-xl bg-destructive-soft px-3 py-2 text-destructive-ink"
            >
                {{ acceptError }}
            </p>

            <div class="mt-10 w-full max-w-xs space-y-3">
                <template v-if="auth.user">
                    <Button
                        variant="inverse"
                        size="lg"
                        block
                        :disabled="accepting"
                        @click="join"
                    >
                        {{
                            accepting
                                ? t('Joining...')
                                : t('Join :name', {
                                      name: preview.circle.name,
                                  })
                        }}
                    </Button>
                </template>
                <template v-else>
                    <Button
                        variant="inverse"
                        size="lg"
                        block
                        @click="goToRegister"
                    >
                        {{ t('Create an account') }}
                    </Button>
                    <Button variant="ghost" size="lg" block @click="goToLogin">
                        {{ t('I already have an account') }}
                    </Button>
                </template>
            </div>
        </div>
    </div>
</template>
