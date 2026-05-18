<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PhotoMap from '@/components/PhotoMap.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useServiceKeysStore } from '@/spa/stores/serviceKeys';

interface Circle {
    id: string;
    name: string;
    photo: string | null;
}

const { t } = useTranslations();
const route = useRoute();
const router = useRouter();

const circleId = computed(() => String(route.params.circle));

const serviceKeys = useServiceKeysStore();
const mapboxToken = computed(() => serviceKeys.mapboxToken);
const circle = ref<Circle | null>(null);
const fetchUrl = computed(() => `/circles/${circleId.value}/photos/map`);

onMounted(async () => {
    try {
        const [_, circleResp] = await Promise.all([
            serviceKeys.ensureLoaded(),
            externalApi.get<{ data: Circle }>(`/circles/${circleId.value}`),
        ]);
        circle.value = circleResp.data;
    } catch {
        router.push({ name: 'spa.circles.index' });
    }
});

function goBack(): void {
    if (window.history.length > 1) {
        router.back();
    } else if (circle.value) {
        router.push({
            name: 'spa.circles.show',
            params: { circle: circle.value.id },
        });
    } else {
        router.push({ name: 'spa.circles.index' });
    }
}

function handlePostClick(postId: string): void {
    router.push({ name: 'spa.posts.show', params: { post: postId } });
}
</script>

<template>
    <AppLayout :title="circle?.name ?? t('Map')">
        <template #header-left>
            <button class="flex items-center text-sand-700" @click="goBack">
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

        <div class="relative mt-10 flex-1">
            <PhotoMap
                v-if="mapboxToken"
                :mapbox-token="mapboxToken"
                :fetch-url="fetchUrl"
                :on-post-click="handlePostClick"
            />
            <div v-else class="flex h-full items-center justify-center">
                <svg
                    class="size-6 animate-spin text-sand-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    />
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            </div>
        </div>
    </AppLayout>
</template>
