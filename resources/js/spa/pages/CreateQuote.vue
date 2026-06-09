<script setup lang="ts">
import { Dialog } from '@nativephp/mobile';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CirclePicker from '@/components/CirclePicker.vue';
import PersonPicker from '@/components/PersonPicker.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import { useApiForm } from '@/spa/composables/useApiForm';
import { uploadInChunks } from '@/spa/composables/useChunkedUpload';
import { QUOTE_GRADIENTS, renderQuote } from '@/spa/composables/useQuoteCanvas';
import type { QuoteGradient } from '@/spa/composables/useQuoteCanvas';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useAuthStore } from '@/spa/stores/auth';
import { useCirclesStore } from '@/spa/stores/circles';
import { useDefaultCirclesStore } from '@/spa/stores/defaultCircles';
import { useFeedCacheStore } from '@/spa/stores/feedCache';
import { useLocalThumbnailsStore } from '@/spa/stores/localThumbnails';
import { usePersonsStore } from '@/spa/stores/persons';

interface Circle {
    id: string;
    name: string;
    photo?: string | null;
    is_owner?: boolean;
}

interface Person {
    id: string;
    name: string;
    avatar?: string | null;
    avatar_thumbnail?: string | null;
    user_id?: string | null;
    circle_ids?: string[];
}

const MAX_QUOTE_LENGTH = 280;

const { t } = useTranslations();
const router = useRouter();
const auth = useAuthStore();
const feedCache = useFeedCacheStore();
const localThumbnails = useLocalThumbnailsStore();
const circlesStore = useCirclesStore();
const personsStore = usePersonsStore();
const defaultCirclesStore = useDefaultCirclesStore();

const circles = computed<Circle[]>(() => circlesStore.items ?? []);
const defaultCircleIds = computed<string[]>(
    () => defaultCirclesStore.ids ?? [],
);
const allPersons = computed<Person[]>(() => personsStore.items ?? []);

// Persons are shared within a circle, so only those in a selected circle can be
// tagged — mirrors CreatePost so the attribution stays consistent.
const availablePersons = computed<Person[]>(() => {
    const selected = form.data.circle_ids;

    if (selected.length === 0) {
        return [];
    }

    return allPersons.value.filter((person) =>
        (person.circle_ids ?? []).some((id) => selected.includes(id)),
    );
});

const form = useApiForm({
    media_paths: [] as string[],
    type: 'quote' as const,
    quote_text: '',
    quote_author: '' as string,
    circle_ids: [] as string[],
    person_ids: [] as string[],
});

const selectedGradientId = ref<string>(QUOTE_GRADIENTS[0].id);
const selectedGradient = computed<QuoteGradient>(
    () =>
        QUOTE_GRADIENTS.find((g) => g.id === selectedGradientId.value) ??
        QUOTE_GRADIENTS[0],
);

// Track whether the user has hand-edited the author, so auto-fill from a tagged
// person never overwrites their own wording.
const authorTouched = ref(false);

async function loadFormData(): Promise<void> {
    try {
        await Promise.all([
            circlesStore.ensureLoaded(),
            defaultCirclesStore.ensureLoaded().catch(() => null),
            personsStore.ensureLoaded().catch(() => null),
        ]);

        const availableIds = circles.value.map((c) => c.id);
        form.data.circle_ids = defaultCircleIds.value.filter((id) =>
            availableIds.includes(id),
        );
    } catch {
        // ignore — the user can still pick circles manually.
    }
}

// Auto-fill the attribution from the first tagged child while the user hasn't
// typed their own. Selecting a kid is the common path; the text field stays
// editable for nicknames ("our little one") or quotes from multiple kids.
watch(
    () => form.data.person_ids,
    (ids) => {
        if (authorTouched.value || ids.length === 0) {
            return;
        }

        const first = allPersons.value.find((p) => p.id === ids[0]);

        if (first) {
            form.data.quote_author = first.name;
        }
    },
);

// Drop tagged persons that fall outside the selected circles.
watch(
    () => form.data.circle_ids,
    () => {
        if (form.data.person_ids.length === 0) {
            return;
        }

        const stillVisible = new Set(availablePersons.value.map((p) => p.id));
        form.data.person_ids = form.data.person_ids.filter((id) =>
            stillVisible.has(id),
        );
    },
);

function onAuthorInput(event: Event): void {
    authorTouched.value = true;
    form.data.quote_author = (event.target as HTMLInputElement).value;
}

// Live preview of the rendered quote. Re-rendered (debounced) whenever the
// text, author, or gradient change so the user sees exactly what gets posted.
const previewUrl = ref<string | null>(null);
let previewTimer: ReturnType<typeof setTimeout> | null = null;

async function renderPreview(): Promise<void> {
    if (form.data.quote_text.trim() === '') {
        previewUrl.value = null;

        return;
    }

    try {
        const { dataUrl } = await renderQuote({
            text: form.data.quote_text,
            author: form.data.quote_author,
            gradient: selectedGradient.value,
        });
        previewUrl.value = dataUrl;
    } catch {
        previewUrl.value = null;
    }
}

watch(
    () => [
        form.data.quote_text,
        form.data.quote_author,
        selectedGradientId.value,
    ],
    () => {
        if (previewTimer) {
            clearTimeout(previewTimer);
        }

        previewTimer = setTimeout(renderPreview, 150);
    },
);

// Wizard steps: 0=write, 1=background, 2=circles, 3=tag child.
const TOTAL_STEPS = 4;
const currentStep = ref(0);

const hasText = computed(() => form.data.quote_text.trim().length > 0);
const hasCircles = computed(() => form.data.circle_ids.length > 0);

const canAdvance = computed(() => {
    if (form.processing) {
        return false;
    }

    switch (currentStep.value) {
        case 0:
            return hasText.value;
        case 2:
            return hasCircles.value;
        default:
            return true;
    }
});

const stepHeading = computed(() => {
    switch (currentStep.value) {
        case 0:
            return t('Capture the quote');
        case 1:
            return t('Pick a background');
        case 2:
            return t('Choose your circles');
        case 3:
            return t('Who said it?');
        default:
            return '';
    }
});

const stepSubtitle = computed(() => {
    switch (currentStep.value) {
        case 0:
            return t('Write down something your child said');
        case 1:
            return t('Choose a background for the quote');
        case 2:
            return t('Choose who you want to share with');
        case 3:
            return t('Tag your child and add their name');
        default:
            return '';
    }
});

const primaryLabel = computed(() => {
    if (currentStep.value === TOTAL_STEPS - 1) {
        return form.processing ? t('Sharing...') : t('Share');
    }

    if (currentStep.value === 3 && form.data.person_ids.length === 0) {
        return t('Skip');
    }

    return t('Next');
});

function goNext(): void {
    if (currentStep.value === TOTAL_STEPS - 1) {
        submit();

        return;
    }

    if (!canAdvance.value) {
        return;
    }

    currentStep.value = Math.min(TOTAL_STEPS - 1, currentStep.value + 1);
}

function goBack(): void {
    if (currentStep.value === 0) {
        router.push({ name: 'spa.home' });

        return;
    }

    currentStep.value = Math.max(0, currentStep.value - 1);
}

function gradientStyle(gradient: QuoteGradient) {
    return {
        backgroundImage: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
    };
}

// Picker thumbnails: render each background once at a small size so its doodle
// motif is visible in the chooser, not just the bare gradient. Rebuilt whenever
// the background step opens so the swatches reflect the current quote text.
const swatches = ref<Record<string, string>>({});

async function buildSwatches(): Promise<void> {
    const sample = form.data.quote_text.trim() || t('What did they say?');

    await Promise.all(
        QUOTE_GRADIENTS.map(async (gradient) => {
            try {
                const { dataUrl } = await renderQuote(
                    { text: sample, author: form.data.quote_author, gradient },
                    220,
                );
                swatches.value[gradient.id] = dataUrl;
            } catch {
                // Leave the gradient fallback in place for this swatch.
            }
        }),
    );
}

watch(currentStep, (step) => {
    if (step === 1) {
        void buildSwatches();
    }
});

onMounted(() => {
    loadFormData();
});

function buildOptimisticPost(previewDataUrl: string): PostData {
    const tempId = `optimistic-${crypto.randomUUID()}`;
    const selectedCircles = circles.value
        .filter((c) => form.data.circle_ids.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name, photo: c.photo ?? null }));

    return {
        id: tempId,
        type: 'quote',
        media_url: previewDataUrl,
        media_type: 'image',
        thumbnail_url: null,
        thumbnail_small_url: null,
        media_status: 'processing',
        media: [
            {
                id: `${tempId}-0`,
                url: previewDataUrl,
                type: 'image',
                status: 'processing',
                thumbnail_url: null,
                thumbnail_small_url: null,
                sort_order: 0,
            },
        ],
        caption: null,
        quote_text: form.data.quote_text,
        quote_author: form.data.quote_author || null,
        location: null,
        created_at: new Date().toISOString(),
        user: {
            id: auth.user?.id ?? '',
            name: auth.user?.name ?? '',
            username: auth.user?.username ?? '',
            avatar: auth.user?.avatar ?? null,
        },
        circles: selectedCircles,
        is_liked: false,
        likes_count: 0,
        comments_count: 0,
    };
}

async function submit(): Promise<void> {
    if (form.processing || !hasText.value || !hasCircles.value) {
        return;
    }

    let rendered;

    try {
        rendered = await renderQuote({
            text: form.data.quote_text,
            author: form.data.quote_author,
            gradient: selectedGradient.value,
        });
    } catch {
        void Dialog.alert(
            t('Could not create quote'),
            t('Rendering the quote image failed. Please try again.'),
        );

        return;
    }

    let path: string;

    try {
        // Quotes carry no capture metadata; the EXIF fields are all null.
        path = await uploadInChunks(rendered.blob, {
            taken_at: null,
            latitude: null,
            longitude: null,
        });
    } catch {
        void Dialog.alert(
            t('Upload failed'),
            t('Could not upload the quote. Please try again.'),
        );

        return;
    }

    form.data.media_paths = [path];

    const optimistic = buildOptimisticPost(rendered.dataUrl);
    const targetCircleIds = [...form.data.circle_ids];

    feedCache.prepend('home', optimistic);

    for (const circleId of targetCircleIds) {
        feedCache.prepend(`circle:${circleId}`, optimistic);
    }

    router.push({ name: 'spa.home' });

    try {
        let realPostId: string | undefined;

        await form.post<{ data: { id: string } }>('/api/spa/posts', {
            onSuccess: (response) => {
                realPostId = response?.data?.id;
            },
        });

        if (realPostId) {
            const swapped: PostData = { ...optimistic, id: realPostId };
            feedCache.replaceById('home', optimistic.id, swapped);

            for (const circleId of targetCircleIds) {
                feedCache.replaceById(
                    `circle:${circleId}`,
                    optimistic.id,
                    swapped,
                );
            }

            localThumbnails.set(realPostId, rendered.dataUrl);
        } else {
            feedCache.invalidate('home');

            for (const circleId of targetCircleIds) {
                feedCache.invalidate(`circle:${circleId}`);
            }
        }
    } catch (error) {
        feedCache.removeItem('home', optimistic.id);

        for (const circleId of targetCircleIds) {
            feedCache.removeItem(`circle:${circleId}`, optimistic.id);
        }

        if (error instanceof ApiError && error.status === 429) {
            const seconds = error.retryAfterSeconds ?? 60;
            const wait =
                seconds === 1
                    ? t('Please try again in :count second.', { count: 1 })
                    : t('Please try again in :count seconds.', {
                          count: seconds,
                      });

            void Dialog.alert(t('Slow down a moment'), wait);
        }
    }
}
</script>

<template>
    <AppLayout :title="t('New quote')">
        <template #header-left>
            <button
                class="flex items-center text-ink"
                :aria-label="t('Back')"
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

        <div class="relative mt-10 flex min-h-full flex-col">
            <div class="shrink-0 px-4 pt-4">
                <div
                    class="flex items-center justify-center gap-1.5"
                    :aria-label="
                        t('Step :current of :total', {
                            current: currentStep + 1,
                            total: TOTAL_STEPS,
                        })
                    "
                >
                    <span
                        v-for="step in TOTAL_STEPS"
                        :key="step"
                        class="h-1.5 rounded-full transition-all duration-200"
                        :class="
                            step - 1 === currentStep
                                ? 'w-8 bg-action'
                                : step - 1 < currentStep
                                  ? 'w-4 bg-action/60'
                                  : 'w-4 bg-sand-200'
                        "
                    />
                </div>
                <p
                    class="mt-3 text-center tracking-widest text-ink-muted uppercase"
                >
                    {{
                        t('Step :current of :total', {
                            current: currentStep + 1,
                            total: TOTAL_STEPS,
                        })
                    }}
                </p>
                <h2
                    class="mt-1 text-center font-display text-2xl font-semibold text-ink"
                >
                    {{ stepHeading }}
                </h2>
                <p class="mt-1 text-center text-ink-muted">
                    {{ stepSubtitle }}
                </p>
            </div>

            <div class="relative mt-6 flex-1 space-y-5 px-4 pb-6">
                <!-- Step 0: write the quote -->
                <section
                    v-show="currentStep === 0"
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <label
                        for="quote-text"
                        class="tracking-wider text-ink-muted uppercase"
                    >
                        {{ t('Quote') }}
                    </label>
                    <textarea
                        id="quote-text"
                        v-model="form.data.quote_text"
                        :placeholder="t('What did they say?')"
                        rows="5"
                        :maxlength="MAX_QUOTE_LENGTH"
                        class="mt-2 w-full resize-none border-0 bg-transparent p-0 font-display text-xl text-ink placeholder-ink-muted/60 focus:ring-0 focus:outline-none"
                    />
                    <p class="mt-2 text-right text-xs text-ink-muted">
                        {{ form.data.quote_text.length }}/{{ MAX_QUOTE_LENGTH }}
                    </p>
                    <p
                        v-if="form.errors.quote_text"
                        class="mt-1 text-destructive-ink"
                    >
                        {{ form.errors.quote_text }}
                    </p>
                </section>

                <!-- Step 1: pick a background + live preview -->
                <template v-if="currentStep === 1">
                    <section
                        class="overflow-hidden rounded-lg bg-surface/50 shadow-sm backdrop-blur-sm"
                    >
                        <div
                            class="mx-auto aspect-square w-full max-w-[min(100%,50vh)]"
                        >
                            <img
                                v-if="previewUrl"
                                :src="previewUrl"
                                :alt="t('Quote preview')"
                                class="size-full object-cover"
                            />
                            <div
                                v-else
                                class="flex size-full items-center justify-center text-ink-muted"
                                :style="gradientStyle(selectedGradient)"
                            >
                                {{ t('Preview') }}
                            </div>
                        </div>
                    </section>

                    <section
                        class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                    >
                        <span class="tracking-wider text-ink-muted uppercase">
                            {{ t('Background') }}
                        </span>
                        <!-- Horizontal slider keeps the preview above in view
                             while scrolling through backgrounds. -->
                        <div
                            class="-mx-1 mt-3 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden"
                        >
                            <button
                                v-for="gradient in QUOTE_GRADIENTS"
                                :key="gradient.id"
                                type="button"
                                class="relative aspect-square w-24 shrink-0 snap-start overflow-hidden rounded-lg ring-2 transition"
                                :class="
                                    gradient.id === selectedGradientId
                                        ? 'ring-action'
                                        : 'ring-transparent'
                                "
                                :style="gradientStyle(gradient)"
                                :aria-label="t('Select background')"
                                :aria-pressed="
                                    gradient.id === selectedGradientId
                                "
                                @click="selectedGradientId = gradient.id"
                            >
                                <img
                                    v-if="swatches[gradient.id]"
                                    :src="swatches[gradient.id]"
                                    :alt="t('Background')"
                                    class="size-full object-cover"
                                />
                                <span
                                    v-else
                                    class="absolute inset-0 flex items-center justify-center font-display text-2xl"
                                    :style="{ color: gradient.text }"
                                >
                                    &ldquo;
                                </span>
                            </button>
                        </div>
                    </section>
                </template>

                <!-- Step 2: choose circles -->
                <section
                    v-show="currentStep === 2"
                    class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                >
                    <CirclePicker
                        v-if="circles.length > 0"
                        :circles="circles"
                        :selected-ids="form.data.circle_ids"
                        :error="form.errors.circle_ids"
                        layout="grid"
                        @update:selected-ids="form.data.circle_ids = $event"
                    />
                    <p v-else class="text-ink-muted">
                        {{
                            t(
                                'Create a circle to set it as a default for new posts.',
                            )
                        }}
                    </p>
                </section>

                <!-- Step 3: tag the child + author -->
                <template v-if="currentStep === 3">
                    <section
                        class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                    >
                        <PersonPicker
                            :persons="availablePersons"
                            :selected-ids="form.data.person_ids"
                            layout="grid"
                            @update:selected-ids="form.data.person_ids = $event"
                        />
                    </section>

                    <section
                        class="rounded-lg bg-surface/50 p-5 shadow-sm backdrop-blur-sm"
                    >
                        <label
                            for="quote-author"
                            class="tracking-wider text-ink-muted uppercase"
                        >
                            {{ t('Name to show') }}
                        </label>
                        <input
                            id="quote-author"
                            :value="form.data.quote_author"
                            type="text"
                            maxlength="100"
                            :placeholder="t('e.g. their first name')"
                            class="mt-2 w-full border-0 bg-transparent p-0 text-base text-ink placeholder-ink-muted/60 focus:ring-0 focus:outline-none"
                            @input="onAuthorInput"
                        />
                        <p
                            v-if="form.errors.quote_author"
                            class="mt-1 text-destructive-ink"
                        >
                            {{ form.errors.quote_author }}
                        </p>
                    </section>
                </template>
            </div>

            <div
                class="sticky bottom-0 z-30 border-t border-sand-200 bg-surface/95 backdrop-blur-md"
                :style="{
                    paddingBottom:
                        'max(var(--inset-bottom, 0px), env(safe-area-inset-bottom, 0px), 1.25rem)',
                }"
            >
                <div class="flex items-center justify-between gap-3 px-4 pt-3">
                    <button
                        type="button"
                        class="rounded-lg px-5 py-2.5 text-ink transition active:bg-sand-100"
                        @click="goBack"
                    >
                        {{ currentStep === 0 ? t('Cancel') : t('Back') }}
                    </button>
                    <button
                        type="button"
                        class="rounded-lg bg-action px-7 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
                        :disabled="!canAdvance || form.processing"
                        @click="goNext"
                    >
                        {{ primaryLabel }}
                    </button>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
