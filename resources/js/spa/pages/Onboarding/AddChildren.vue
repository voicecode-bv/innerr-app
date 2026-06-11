<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Spinner from '@/components/Spinner.vue';
import OnboardingHeader from '@/spa/components/OnboardingHeader.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { api, ApiError } from '@/spa/http/apiClient';
import { externalApi } from '@/spa/http/externalApi';
import { trackOnboardingStep } from '@/spa/http/onboarding';
import { haptics } from '@/spa/services/haptics';
import { Camera, Dialog, Events, Off, On } from '@nativephp/mobile';
import cakeIcon from '../../../../svg/doodle-icons/cake.svg';
import cameraIcon from '../../../../svg/doodle-icons/camera.svg';
import userIcon from '../../../../svg/doodle-icons/user.svg';

interface Circle {
    id: string;
    name: string;
}

interface Person {
    id: string;
    name: string;
    avatar_thumbnail: string | null;
    user_id?: string | null;
}

interface AddedChild {
    id: string;
    name: string;
    preview: string | null;
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

const circleId = String(route.params.circle);
const circle = ref<Circle | null>(null);
const children = ref<AddedChild[]>([]);

const nameInput = useTemplateRef<HTMLInputElement>('nameInput');

// Removing a just-added child (typo, duplicate) without leaving the flow.
const removingChildId = ref<string | null>(null);
const removeError = ref<string | null>(null);
let pendingRemoveChildId: string | null = null;

async function confirmRemoveChild(child: AddedChild): Promise<void> {
    pendingRemoveChildId = child.id;
    removeError.value = null;

    await Dialog.alert()
        .confirm(
            t('Remove person'),
            t('Are you sure you want to remove ":name"?', {
                name: child.name,
            }),
        )
        .id('onboarding-remove-child-confirm');
}

async function handleAlertButtonPressed(payload: {
    index: number;
    id?: string | null;
}): Promise<void> {
    if (
        payload.id !== 'onboarding-remove-child-confirm' ||
        payload.index !== 1 ||
        pendingRemoveChildId === null
    ) {
        return;
    }

    const childId = pendingRemoveChildId;
    pendingRemoveChildId = null;
    removingChildId.value = childId;

    try {
        await externalApi.delete(`/persons/${childId}`);
        children.value = children.value.filter((c) => c.id !== childId);
        haptics.impactLight();
    } catch {
        removeError.value = t('Failed to remove child');
    } finally {
        removingChildId.value = null;
    }
}

const name = ref('');
const birthdate = ref('');
const pendingPhotoPath = ref<string | null>(null);
const pendingPhotoPreview = ref<string | null>(null);

const isAdding = ref(false);
const photoUploading = ref(false);
const nameError = ref<string | null>(null);
const formError = ref<string | null>(null);
// Non-blocking warning: the child was created but their photo did not make
// it; silently dropping it would leave the user thinking it was saved.
const photoWarning = ref<string | null>(null);

// Soft duplicate guard: warns (without blocking, two children can genuinely
// share a name) when the typed name matches an already-added child.
const duplicateNameWarning = computed(() => {
    const trimmed = name.value.trim().toLowerCase();

    if (trimmed === '') {
        return null;
    }

    return children.value.some(
        (child) => child.name.trim().toLowerCase() === trimmed,
    )
        ? t('A child with this name is already in your circle.')
        : null;
});

const todayIso = new Date().toISOString().slice(0, 10);

onMounted(async () => {
    try {
        const data = await externalApi.get<{ data: Circle }>(
            `/circles/${circleId}`,
        );
        circle.value = { id: data.data.id, name: data.data.name };
    } catch {
        // The fetch only feeds the circle-name badge; the form itself works
        // off the route param, so a failure must not skip this step.
    }
});

// Seed the "Added" list with the circle's existing children. The list is
// otherwise component-local: navigating back and returning would present an
// empty list and invite accidental duplicates of an already-added child.
onMounted(async () => {
    try {
        const existing = await externalApi.get<{ data: Person[] }>(
            `/persons?circle_id=${encodeURIComponent(circleId)}`,
        );

        const locallyAdded = new Set(children.value.map((c) => c.id));
        children.value = [
            ...children.value,
            ...existing.data
                // Member-persons (records linked to an account, including
                // yourself) are taggable people, not children — keep them out
                // of this list, mirroring the filter the rest of the app uses.
                .filter((p) => !p.user_id && !locallyAdded.has(p.id))
                .map((p) => ({
                    id: p.id,
                    name: p.name,
                    preview: p.avatar_thumbnail,
                })),
        ];
    } catch {
        // Cosmetic: without the seed the page simply behaves as before.
    }
});

async function loadPreview(path: string): Promise<string | null> {
    try {
        const response = await fetch(
            `/native-media?path=${encodeURIComponent(path)}`,
        );

        if (!response.ok) {
            return null;
        }

        const { data_url } = await response.json();

        return data_url;
    } catch {
        return null;
    }
}

async function pickPhoto(): Promise<void> {
    await Camera.pickImages().all();
}

function removePhoto(): void {
    pendingPhotoPath.value = null;
    pendingPhotoPreview.value = null;
}

async function handleMediaSelected(payload: {
    success: boolean;
    files: { path: string; mimeType: string }[];
    cancelled: boolean;
}): Promise<void> {
    if (!payload.success || payload.cancelled || !payload.files.length) {
        return;
    }

    const path = payload.files[0].path;
    pendingPhotoPath.value = path;
    pendingPhotoPreview.value = await loadPreview(path);
}

function resetDraft(): void {
    name.value = '';
    birthdate.value = '';
    pendingPhotoPath.value = null;
    pendingPhotoPreview.value = null;
    nameError.value = null;
    formError.value = null;
}

async function addChild(): Promise<void> {
    const trimmed = name.value.trim();

    nameError.value = null;
    formError.value = null;
    photoWarning.value = null;

    if (!trimmed) {
        nameError.value = t('Please enter a name.');

        return;
    }

    if (isAdding.value) {
        return;
    }

    isAdding.value = true;

    try {
        const data = await externalApi.post<{ data: Person }>('/persons', {
            name: trimmed,
            birthdate: birthdate.value === '' ? null : birthdate.value,
            is_child: true,
            circle_ids: [circleId],
        });

        let preview = pendingPhotoPreview.value;

        if (pendingPhotoPath.value) {
            photoUploading.value = true;

            try {
                await api.post(
                    `/api/spa/settings/persons/${data.data.id}/photo`,
                    { photo_path: pendingPhotoPath.value },
                );
            } catch {
                // Foto-upload mag de onboarding niet blokkeren; het kind is al
                // aangemaakt en de foto kan later in instellingen toegevoegd.
                preview = null;
                photoWarning.value = t(
                    'The photo could not be uploaded. You can add it later.',
                );
            } finally {
                photoUploading.value = false;
            }
        }

        children.value = [
            { id: data.data.id, name: trimmed, preview },
            ...children.value,
        ];

        resetDraft();
        // Confirm the add and set up the fast path for the next child:
        // parents with several kids stay in the flow without re-tapping.
        haptics.notifySuccess();
        nameInput.value?.focus();
    } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
            nameError.value = error.errors.name?.[0] ?? null;

            if (!nameError.value) {
                formError.value = error.message;
            }
        } else {
            formError.value = t('Failed to add child');
        }
    } finally {
        isAdding.value = false;
    }
}

function continueOnboarding(): void {
    trackOnboardingStep('add_children');
    router.push({
        name: 'spa.onboarding.first-moment',
        params: { circle: circleId },
    });
}

onMounted(() => {
    On(Events.Gallery.MediaSelected, handleMediaSelected);
    On(Events.Alert.ButtonPressed, handleAlertButtonPressed);
});

onUnmounted(() => {
    Off(Events.Gallery.MediaSelected, handleMediaSelected);
    Off(Events.Alert.ButtonPressed, handleAlertButtonPressed);
});
</script>

<template>
    <div
        class="nativephp-safe-area relative isolate flex min-h-dvh flex-col overflow-hidden bg-sand px-6 text-ink"
    >
        <!-- Same atmosphere as the rest of the flow: soft glows + film grain. -->
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 -z-10"
        >
            <div
                class="absolute -top-20 -right-16 size-72 rounded-full bg-sage-200/40 blur-3xl"
            ></div>
            <div
                class="absolute bottom-10 -left-20 size-72 rounded-full bg-brand-yellow/15 blur-3xl"
            ></div>
            <div class="absolute inset-0 grain opacity-[0.04]"></div>
        </div>

        <OnboardingHeader
            :step="1"
            :back-to="{ name: 'spa.onboarding.intro' }"
        />
        <!-- Top-aligned on purpose: the added-children list grows below the
             form, so the form itself must not shift on every add. -->
        <div class="relative flex flex-1 flex-col items-center py-8">
            <div class="mb-8 text-center">
                <span
                    class="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success-ink shadow-sm"
                >
                    {{ circle?.name ?? ' ' }}
                </span>
                <h1
                    class="mt-3 text-4xl font-extrabold tracking-tight text-ink"
                >
                    {{ t('Add your children') }}
                </h1>
                <p class="mx-auto mt-3 max-w-xs text-ink-muted">
                    {{
                        t(
                            'Add your children so you can tag them in the photos you share.',
                        )
                    }}
                </p>
            </div>

            <div class="w-full max-w-sm space-y-5">
                <form
                    class="rounded-2xl bg-surface/80 p-5 shadow-sm ring-1 ring-sand-200/70 backdrop-blur-sm"
                    @submit.prevent="addChild"
                >
                    <div class="flex flex-col items-center gap-3">
                        <button
                            type="button"
                            class="relative"
                            :aria-label="t('Add a photo')"
                            :disabled="photoUploading"
                            @click="pickPhoto"
                        >
                            <img
                                v-if="pendingPhotoPreview"
                                :src="pendingPhotoPreview"
                                :alt="name"
                                class="avatar-ring size-20 rounded-full object-cover shadow-sm"
                                :class="photoUploading ? 'opacity-50' : ''"
                            />
                            <span
                                v-else
                                class="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-sand-300 bg-sand-50 text-ink-muted/70"
                                :class="photoUploading ? 'opacity-50' : ''"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-9 bg-current"
                                    :style="iconMaskStyle(userIcon)"
                                ></span>
                            </span>
                            <span
                                v-if="photoUploading"
                                class="absolute inset-0 flex items-center justify-center rounded-full bg-black/25"
                            >
                                <Spinner class="size-6 text-white" />
                            </span>
                            <span
                                class="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-brand-yellow shadow-md ring-2 ring-white/70"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-4 bg-brand-blue"
                                    :style="iconMaskStyle(cameraIcon)"
                                ></span>
                            </span>
                        </button>
                        <button
                            v-if="pendingPhotoPreview"
                            type="button"
                            class="rounded-full bg-destructive-soft px-3 py-1 text-xs font-medium text-destructive-ink transition-colors"
                            @click="removePhoto"
                        >
                            {{ t('Remove photo') }}
                        </button>
                        <p v-else class="text-xs text-ink-muted">
                            {{ t('Add a photo (optional)') }}
                        </p>
                    </div>

                    <div class="mt-4">
                        <label
                            for="child-name"
                            class="text-xs font-semibold tracking-widest text-ink-muted uppercase"
                        >
                            {{ t('Name') }}
                        </label>
                        <input
                            id="child-name"
                            ref="nameInput"
                            v-model="name"
                            type="text"
                            :placeholder="t('Name...')"
                            autocapitalize="words"
                            enterkeyhint="done"
                            maxlength="50"
                            class="mt-2 box-border field w-full min-w-0"
                        />
                        <p v-if="nameError" class="mt-1 text-destructive-ink">
                            {{ nameError }}
                        </p>
                        <p
                            v-else-if="duplicateNameWarning"
                            class="mt-1 text-ink-muted"
                        >
                            {{ duplicateNameWarning }}
                        </p>
                    </div>

                    <div class="mt-4">
                        <label
                            for="child-birthdate"
                            class="text-xs font-semibold tracking-widest text-ink-muted uppercase"
                        >
                            {{ t('Birthdate') }}
                            <span class="normal-case">
                                ({{ t('optional') }})
                            </span>
                        </label>
                        <input
                            id="child-birthdate"
                            v-model="birthdate"
                            type="date"
                            :max="todayIso"
                            min="1900-01-02"
                            class="mt-2 box-border block field w-full min-w-0 appearance-none"
                        />
                    </div>

                    <p v-if="formError" class="mt-3 text-destructive-ink">
                        {{ formError }}
                    </p>

                    <p v-if="photoWarning" class="mt-3 text-ink-muted">
                        {{ photoWarning }}
                    </p>

                    <button
                        type="submit"
                        :disabled="!name.trim() || isAdding || photoUploading"
                        class="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-action py-3 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Spinner v-if="isAdding" class="size-5" />
                        <span
                            v-else
                            aria-hidden="true"
                            class="inline-block size-5 bg-current"
                            :style="iconMaskStyle(userIcon)"
                        ></span>
                        <span>{{ t('Add child') }}</span>
                    </button>
                </form>

                <div v-if="children.length > 0">
                    <div class="mb-3 flex items-center justify-between">
                        <p
                            class="text-xs font-semibold tracking-widest text-ink-muted uppercase"
                        >
                            {{ t('Added') }}
                        </p>
                        <span
                            class="inline-flex size-6 items-center justify-center rounded-full bg-action leading-none font-semibold text-white shadow-sm"
                        >
                            {{ children.length }}
                        </span>
                    </div>
                    <TransitionGroup
                        tag="ul"
                        class="relative space-y-2"
                        enter-active-class="transition duration-300 ease-out"
                        enter-from-class="-translate-y-2 opacity-0"
                        leave-active-class="absolute inset-x-0 transition duration-200 ease-in"
                        leave-to-class="opacity-0 -translate-x-2"
                        move-class="transition-transform duration-300"
                    >
                        <li
                            v-for="child in children"
                            :key="child.id"
                            class="flex items-center gap-3 rounded-full bg-surface/80 px-4 py-2 shadow-sm ring-1 ring-sand-200/70"
                        >
                            <img
                                v-if="child.preview"
                                :src="child.preview"
                                :alt="child.name"
                                class="size-9 shrink-0 rounded-full object-cover"
                            />
                            <span
                                v-else
                                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-5 bg-current"
                                    :style="iconMaskStyle(cakeIcon)"
                                ></span>
                            </span>
                            <span class="min-w-0 flex-1 truncate text-ink">{{
                                child.name
                            }}</span>
                            <button
                                type="button"
                                class="hit-slop relative flex size-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-destructive-soft hover:text-destructive-ink"
                                :aria-label="t('Remove')"
                                :disabled="removingChildId !== null"
                                @click="confirmRemoveChild(child)"
                            >
                                <Spinner
                                    v-if="removingChildId === child.id"
                                    class="size-3.5"
                                />
                                <svg
                                    v-else
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
                    </TransitionGroup>
                    <p v-if="removeError" class="mt-2 text-destructive-ink">
                        {{ removeError }}
                    </p>
                </div>
            </div>
        </div>

        <!-- Skipping is a text link, not a primary button: filling the step
             in should look more attractive than skipping it. -->
        <div class="relative pt-2 pb-8">
            <button
                v-if="children.length > 0"
                class="w-full rounded-lg bg-action py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover"
                @click="continueOnboarding"
            >
                {{ t('Continue') }}
            </button>
            <button
                v-else
                class="w-full py-3.5 font-medium text-ink-muted transition-colors hover:text-ink"
                @click="continueOnboarding"
            >
                {{ t('Add later') }}
            </button>
        </div>
    </div>
</template>
