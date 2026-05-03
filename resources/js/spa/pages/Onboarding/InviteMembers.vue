<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useApiForm } from '@/spa/composables/useApiForm';
import { externalApi } from '@/spa/http/externalApi';
import { ApiError } from '@/spa/http/apiClient';
import userAddIcon from '../../../../svg/doodle-icons/user-add.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

interface Circle {
    id: number;
    name: string;
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
const form = useApiForm({ identifier: '' });

const circleId = Number(route.params.circle);

onMounted(async () => {
    try {
        const data = await externalApi.get<{ data: Circle }>(
            `/circles/${circleId}`,
        );
        circle.value = { id: data.data.id, name: data.data.name };
    } catch {
        router.push({ name: 'spa.onboarding.first-circle' });
    }
});

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

function continueOnboarding(): void {
    router.push({ name: 'spa.onboarding.notifications' });
}
</script>

<template>
    <div
        class="nativephp-safe-area relative flex min-h-dvh flex-col overflow-hidden bg-warmwhite px-6 text-sand-900 dark:bg-sand-900 dark:text-sand-100"
    >
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <div
                class="absolute -top-24 -left-24 size-72 rounded-full bg-sage-200/60 blur-3xl dark:bg-sage-700/20"
            ></div>
            <div
                class="absolute top-1/3 -right-28 size-80 rounded-full bg-accent-soft/40 blur-3xl dark:bg-accent/10"
            ></div>
            <div
                class="absolute -bottom-32 left-1/4 size-96 rounded-full bg-sand-200/50 blur-3xl dark:bg-sand-700/30"
            ></div>
        </div>

        <div
            class="relative flex flex-1 flex-col items-center justify-center py-12"
        >
            <div class="mb-10 text-center">
                <p class="tracking-widest text-accent uppercase">
                    {{ circle?.name ?? ' ' }}
                </p>
                <h1
                    class="mt-3 font-display text-4xl font-black tracking-tight text-teal"
                >
                    {{ t('Invite your people') }}
                </h1>
                <p class="mt-3 text-sand-600 dark:text-sand-400">
                    {{
                        t(
                            'Add family or friends to this circle. They will be able to see what you share.',
                        )
                    }}
                </p>
            </div>

            <div class="w-full max-w-sm space-y-5">
                <form
                    class="relative rounded-lg bg-white/50 p-5 shadow-sm backdrop-blur-sm dark:border-sand-700/50 dark:bg-sand-800/60"
                    @submit.prevent="submit"
                >
                    <label
                        for="invite-identifier"
                        class="tracking-wider text-sand-500 uppercase dark:text-sand-400"
                    >
                        {{ t('Username or email') }}
                    </label>
                    <div class="mt-3 flex items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-teal dark:bg-sage-900/40"
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
                            class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-sand-900 placeholder-sand-400 focus:ring-0 focus:outline-none dark:text-sand-100 dark:placeholder-sand-500"
                        />
                        <button
                            type="submit"
                            :aria-label="t('Add')"
                            :disabled="
                                !form.data.identifier.trim() || form.processing
                            "
                            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal text-white shadow-sm transition hover:bg-teal-light disabled:opacity-40"
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
                        class="mt-2 text-blush-500"
                    >
                        {{ form.errors.identifier }}
                    </p>
                </form>

                <div v-if="invited.length > 0">
                    <div class="mb-3 flex items-center justify-between">
                        <p
                            class="tracking-wider text-sand-500 uppercase dark:text-sand-400"
                        >
                            {{ t('Invited') }}
                        </p>
                        <span
                            class="inline-flex size-6 items-center justify-center rounded-full bg-teal leading-none font-semibold text-white shadow-sm"
                        >
                            {{ invited.length }}
                        </span>
                    </div>
                    <ul class="space-y-2">
                        <li
                            v-for="identifier in invited"
                            :key="identifier"
                            class="flex items-center gap-3 rounded-full bg-white/70 px-4 py-2.5 shadow-sm dark:border-sand-700/50 dark:bg-sand-800/60"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-5 shrink-0 bg-teal"
                                :style="iconMaskStyle(userIcon)"
                            ></span>
                            <span
                                class="truncate text-sand-800 dark:text-sand-100"
                                >{{ identifier }}</span
                            >
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="relative pt-2 pb-8">
            <button
                class="flex w-full items-center justify-center gap-2 rounded-lg bg-teal py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-teal-light"
                @click="continueOnboarding"
            >
                <span>{{
                    invited.length > 0 ? t('Continue') : t('Invite later')
                }}</span>
                <span
                    v-if="invited.length > 0"
                    class="inline-flex size-5 items-center justify-center rounded-full bg-white/20 leading-none font-semibold"
                >
                    {{ invited.length }}
                </span>
            </button>
        </div>
    </div>
</template>
