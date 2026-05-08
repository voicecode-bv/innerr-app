<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import BottomSheet from '@/components/BottomSheet.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { usePostCacheStore } from '@/spa/stores/postCache';
import { useServiceKeysStore } from '@/spa/stores/serviceKeys';
import { externalApi } from '@/spa/http/externalApi';
import userIcon from '../../../svg/doodle-icons/user.svg';

interface Circle {
    id: string;
    name: string;
    photo: string | null;
}

interface Tag {
    id: string;
    name: string;
}

interface Person {
    id: string;
    name: string;
    avatar_thumbnail?: string | null;
    user_id?: string | null;
    user_username?: string | null;
    birthdate?: string | null;
}

interface Post {
    id: string;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    taken_at: string | null;
    circles?: Circle[];
    tags?: Tag[];
    persons?: Person[];
}

const props = defineProps<{
    open: boolean;
    postId: string | null;
}>();

defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const { t } = useTranslations();
const postCache = usePostCacheStore();
const serviceKeys = useServiceKeysStore();

const post = ref<Post | null>(null);
const isLoading = ref(false);

async function load(postId: string): Promise<void> {
    const cached = postCache.get<Post>(postId);
    if (cached) {
        post.value = cached;
    } else {
        post.value = postCache.getStale<Post>(postId);
        isLoading.value = post.value === null;
    }
    try {
        const data = await externalApi.get<{ data: Post }>(`/posts/${postId}`);
        if (props.postId === postId) {
            post.value = data.data;
        }
        postCache.set(postId, data.data);
    } catch {
        // negeren — sheet blijft op cache of leeg
    } finally {
        if (props.postId === postId) {
            isLoading.value = false;
        }
    }
}

watch(
    () => [props.open, props.postId] as const,
    ([open, id]) => {
        if (!open || !id) return;
        if (post.value?.id !== id) post.value = null;
        load(id);
    },
    { immediate: true },
);

const hasLocation = computed(
    () =>
        post.value?.latitude !== null &&
        post.value?.latitude !== undefined &&
        post.value?.longitude !== null &&
        post.value?.longitude !== undefined,
);

const staticMapUrl = computed<string | null>(() => {
    const token = serviceKeys.mapboxToken;
    if (!token || !hasLocation.value || !post.value) return null;
    const lng = post.value.longitude;
    const lat = post.value.latitude;
    const pin = `pin-l+1d5f5c(${lng},${lat})`;
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},14/640x320@2x?access_token=${token}`;
});

const mapTarget = computed(() => {
    const firstCircle = post.value?.circles?.[0];
    return firstCircle
        ? { name: 'spa.circles.map', params: { circle: firstCircle.id } }
        : { name: 'spa.map' };
});

const hasAnyDetails = computed(() => {
    if (!post.value) return false;
    return (
        (post.value.circles ?? []).length > 0 ||
        (post.value.persons ?? []).length > 0 ||
        (post.value.tags ?? []).length > 0 ||
        !!staticMapUrl.value
    );
});

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

function ageAt(
    birthdate: string | null | undefined,
    atDateString: string,
): string | null {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const at = new Date(atDateString);
    if (isNaN(birth.getTime()) || isNaN(at.getTime()) || at < birth)
        return null;

    const totalDays = Math.floor((at.getTime() - birth.getTime()) / 86_400_000);

    if (totalDays < 7) {
        return t(totalDays === 1 ? ':count day' : ':count days', {
            count: totalDays,
        });
    }

    let years = at.getFullYear() - birth.getFullYear();
    let months = at.getMonth() - birth.getMonth();
    if (at.getDate() < birth.getDate()) {
        months -= 1;
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }

    if (years === 0 && months === 0) {
        const weeks = Math.floor(totalDays / 7);
        return t(weeks === 1 ? ':count week' : ':count weeks', {
            count: weeks,
        });
    }

    if (years === 0) {
        return t(months === 1 ? ':count month' : ':count months', {
            count: months,
        });
    }

    if (years < 5 && months > 0) {
        const yearPart = t(years === 1 ? ':count year' : ':count years', {
            count: years,
        });
        const monthPart = t(months === 1 ? ':count month' : ':count months', {
            count: months,
        });
        return `${yearPart} ${monthPart}`;
    }

    return t(years === 1 ? ':count year' : ':count years', { count: years });
}
</script>

<template>
    <BottomSheet :open="open" @update:open="$emit('update:open', $event)">
        <template #header>
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-sand-700 dark:text-sand-300">
                    {{ t('Details') }}
                </h2>
                <button
                    class="text-sand-500 dark:text-sand-400"
                    :aria-label="t('Close')"
                    @click="$emit('update:open', false)"
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

        <div v-if="isLoading && !post" class="space-y-4 px-4 py-6">
            <div class="h-4 w-24 animate-pulse rounded bg-sand-200 dark:bg-sand-700" />
            <div class="flex flex-wrap gap-2">
                <div
                    v-for="n in 3"
                    :key="n"
                    class="h-9 w-28 animate-pulse rounded-full bg-sand-200 dark:bg-sand-700"
                />
            </div>
        </div>

        <div
            v-else-if="post && hasAnyDetails"
            class="space-y-5 px-4 pt-4 pb-24"
        >
            <section
                v-if="(post.circles ?? []).length > 0"
                class="space-y-3"
            >
                <h3
                    class="font-semibold tracking-[0.18em] text-sand-500 uppercase dark:text-sand-400"
                >
                    {{ t('Circles') }}
                </h3>
                <div class="flex flex-wrap gap-2">
                    <RouterLink
                        v-for="circle in post.circles"
                        :key="circle.id"
                        :to="{
                            name: 'spa.circles.show',
                            params: { circle: circle.id },
                        }"
                        class="inline-flex items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1 font-semibold text-sand-800 shadow-sm ring-1 ring-sand-100 transition-colors hover:bg-sand-50 dark:bg-sand-800 dark:text-sand-100 dark:ring-sand-700/60 dark:hover:bg-sand-700"
                    >
                        <img
                            v-if="circle.photo"
                            :src="circle.photo"
                            :alt="circle.name"
                            class="size-7 rounded-full object-cover"
                        />
                        <span
                            v-else
                            class="flex size-7 items-center justify-center rounded-full bg-sage-100 text-teal dark:bg-sage-900/40"
                        >
                            <span
                                aria-hidden="true"
                                class="inline-block size-3.5 bg-current"
                                :style="iconMaskStyle(userIcon)"
                            ></span>
                        </span>
                        {{ circle.name }}
                    </RouterLink>
                </div>
            </section>

            <section
                v-if="(post.persons ?? []).length > 0"
                class="space-y-3"
            >
                <h3
                    class="font-semibold tracking-[0.18em] text-sand-500 uppercase dark:text-sand-400"
                >
                    {{ t('Persons') }}
                </h3>
                <div class="flex flex-wrap gap-2">
                    <component
                        v-for="person in post.persons"
                        :key="person.id"
                        :is="person.user_username ? RouterLink : 'span'"
                        :to="
                            person.user_username
                                ? {
                                      name: 'spa.profiles.show',
                                      params: { username: person.user_username },
                                  }
                                : undefined
                        "
                        class="inline-flex items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1 font-semibold text-sand-800 shadow-sm ring-1 ring-sand-100 dark:bg-sand-800 dark:text-sand-100 dark:ring-sand-700/60"
                        :class="
                            person.user_username
                                ? 'transition-colors hover:bg-sand-50 dark:hover:bg-sand-700'
                                : ''
                        "
                    >
                        <img
                            v-if="person.avatar_thumbnail"
                            :src="person.avatar_thumbnail"
                            :alt="person.name"
                            class="size-7 rounded-full object-cover"
                        />
                        <span
                            v-else
                            class="flex size-7 items-center justify-center rounded-full bg-sage-100 text-teal dark:bg-sage-900/40"
                        >
                            <span
                                class="font-display font-semibold uppercase"
                                >{{ person.name.charAt(0) }}</span
                            >
                        </span>
                        {{ person.name }}
                        <span
                            v-if="
                                ageAt(
                                    person.birthdate,
                                    post.taken_at ?? post.created_at,
                                )
                            "
                            class="font-normal text-sand-500 dark:text-sand-400"
                        >
                            ·
                            {{
                                ageAt(
                                    person.birthdate,
                                    post.taken_at ?? post.created_at,
                                )
                            }}
                        </span>
                    </component>
                </div>
            </section>

            <section
                v-if="(post.tags ?? []).length > 0"
                class="space-y-3"
            >
                <h3
                    class="font-semibold tracking-[0.18em] text-sand-500 uppercase dark:text-sand-400"
                >
                    {{ t('Tags') }}
                </h3>
                <div class="flex flex-wrap gap-2">
                    <span
                        v-for="tag in post.tags"
                        :key="tag.id"
                        class="rounded-full bg-linear-to-r from-sage-100 to-teal-muted/30 px-3.5 py-1.5 font-semibold text-teal ring-1 ring-teal/15 ring-inset dark:from-sage-900/40 dark:to-teal-muted/15 dark:text-sage-200 dark:ring-sage-700/40"
                    >
                        {{ tag.name }}
                    </span>
                </div>
            </section>

            <section v-if="staticMapUrl" class="space-y-3">
                <h3
                    class="font-semibold tracking-[0.18em] text-sand-500 uppercase dark:text-sand-400"
                >
                    {{ t('Location') }}
                </h3>
                <RouterLink
                    :to="mapTarget"
                    class="relative block aspect-[2/1] w-full overflow-hidden rounded-2xl bg-sand-100 shadow-sm ring-1 ring-sand-100 dark:bg-sand-800 dark:ring-sand-700/60"
                    :aria-label="t('Open map')"
                >
                    <img
                        :src="staticMapUrl"
                        :alt="post.location ?? t('Open map')"
                        class="size-full object-cover"
                        loading="lazy"
                        decoding="async"
                    />
                    <div
                        v-if="post.location"
                        class="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-4 pt-10 pb-3 text-white"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="size-4 drop-shadow"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                            />
                        </svg>
                        <span class="drop-shadow">{{ post.location }}</span>
                    </div>
                </RouterLink>
            </section>
        </div>

        <div
            v-else-if="post"
            class="px-4 py-10 text-center text-sand-500 dark:text-sand-400"
        >
            {{ t('No details for this moment.') }}
        </div>
    </BottomSheet>
</template>
