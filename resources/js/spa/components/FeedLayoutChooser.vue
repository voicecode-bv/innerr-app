<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FeedLayoutModal from '@/spa/components/FeedLayoutModal.vue';
import { useFeedLayout } from '@/spa/composables/useFeedLayout';
import type { FeedLayout } from '@/spa/stores/auth';
import { useFeatureTourStore } from '@/spa/stores/featureTour';

const router = useRouter();
const featureTour = useFeatureTourStore();
const { hasChosen } = useFeedLayout();

const open = ref(false);

// Show the one-time chooser once the onboarding tour is out of the way and the
// user hasn't picked a layout yet. We wait for `bootResolved` so a brand new
// user's not-yet-started tour (briefly 'idle' at boot) isn't mistaken for a
// finished one; once resolved, any non-running state means the tour is done —
// completed or dismissed — for new and existing users alike.
function maybeShow(): void {
    if (
        !hasChosen.value &&
        featureTour.bootResolved &&
        featureTour.status !== 'running'
    ) {
        open.value = true;
    }
}

function onChosen(layout: FeedLayout): void {
    const target = layout === 'masonry' ? 'spa.home.grid' : 'spa.home';

    if (router.currentRoute.value.name !== target) {
        router.push({ name: target });
    }
}

watch(() => [featureTour.status, featureTour.bootResolved], maybeShow);

onMounted(maybeShow);
</script>

<template>
    <FeedLayoutModal
        :open="open"
        @update:open="open = $event"
        @chosen="onChosen"
    />
</template>
