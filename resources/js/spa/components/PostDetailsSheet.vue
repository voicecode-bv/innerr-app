<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import BottomSheet from '@/components/BottomSheet.vue';
import Chip from '@/components/Chip.vue';
import SheetHeader from '@/components/SheetHeader.vue';
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
    const pin = `pin-l+373d8a(${lng},${lat})`;
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
            <SheetHeader
                :title="t('Details')"
                @close="$emit('update:open', false)"
            />
        </template>

        <div v-if="isLoading && !post" class="space-y-4 px-4 py-6">
            <div class="h-4 w-24 animate-pulse rounded bg-sand-200" />
            <div class="flex flex-wrap gap-2">
                <div
                    v-for="n in 3"
                    :key="n"
                    class="h-9 w-28 animate-pulse rounded-full bg-sand-200"
                />
            </div>
        </div>

        <div
            v-else-if="post && hasAnyDetails"
            class="space-y-5 px-4 pt-4 pb-24"
        >
            <section v-if="(post.circles ?? []).length > 0" class="space-y-3">
                <h3 class="font-semibold text-brand-blue">
                    {{ t('Circles') }}
                </h3>
                <div class="flex flex-wrap gap-2">
                    <Chip
                        v-for="circle in post.circles"
                        :key="circle.id"
                        :label="circle.name"
                        :photo="circle.photo"
                        :icon-url="userIcon"
                        :to="{
                            name: 'spa.circles.show',
                            params: { circle: circle.id },
                        }"
                    />
                </div>
            </section>

            <section v-if="(post.persons ?? []).length > 0" class="space-y-3">
                <h3 class="font-semibold text-brand-blue">
                    {{ t('Persons') }}
                </h3>
                <div class="flex flex-wrap gap-2">
                    <Chip
                        v-for="person in post.persons"
                        :key="person.id"
                        :label="person.name"
                        :photo="person.avatar_thumbnail"
                        :initial="person.name.charAt(0)"
                        :to="
                            person.user_username
                                ? {
                                      name: 'spa.profiles.show',
                                      params: {
                                          username: person.user_username,
                                      },
                                  }
                                : undefined
                        "
                    >
                        <template
                            v-if="
                                ageAt(
                                    person.birthdate,
                                    post.taken_at ?? post.created_at,
                                )
                            "
                            #meta
                        >
                            <span class="font-normal text-teal-muted">
                                ·
                                {{
                                    ageAt(
                                        person.birthdate,
                                        post.taken_at ?? post.created_at,
                                    )
                                }}
                            </span>
                        </template>
                    </Chip>
                </div>
            </section>

            <section v-if="(post.tags ?? []).length > 0" class="space-y-3">
                <h3 class="font-semibold text-brand-blue">
                    {{ t('Tags') }}
                </h3>
                <div class="flex flex-wrap gap-2">
                    <Chip
                        v-for="tag in post.tags"
                        :key="tag.id"
                        :label="tag.name"
                    />
                </div>
            </section>

            <section v-if="staticMapUrl" class="space-y-3">
                <h3 class="font-semibold text-brand-blue">
                    {{ t('Location') }}
                </h3>
                <RouterLink
                    :to="mapTarget"
                    class="relative block aspect-[2/1] w-full overflow-hidden rounded-2xl bg-sand-100 shadow-sm ring-1 ring-sand-100"
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

        <div v-else-if="post" class="px-4 py-10 text-center text-teal-muted">
            {{ t('No details for this moment.') }}
        </div>
    </BottomSheet>
</template>
