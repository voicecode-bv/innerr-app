<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFeatureTour } from '@/spa/composables/useFeatureTour';
import { useFeatureTourStore } from '@/spa/stores/featureTour';

const route = useRoute();
const router = useRouter();
const store = useFeatureTourStore();
const { run, abort } = useFeatureTour();

// Hydrate server state once (graceful fallback to localStorage in the store
// if the endpoint doesn't exist yet).
void store.hydrate();

async function maybeProgress(): Promise<void> {
    if (store.status !== 'running') {
        abort();

        return;
    }

    const segment = store.activeSegment;

    if (!segment) {
        return;
    }

    // Mismatch between the active segment and the current route → navigate
    // there. The watcher fires again after the route change and then takes
    // the "match" branch.
    if (route.name !== segment.routeName) {
        abort();

        let params: Record<string, string> | null | undefined;

        if (segment.resolveParams) {
            params = segment.resolveParams();

            if (params === null) {
                // Required data not available yet (e.g. no circles yet) →
                // skip this segment so the tour doesn't get stuck.
                store.markSegmentDone(segment.name);

                return;
            }
        }

        try {
            await router.push({
                name: segment.routeName,
                params: params ?? {},
            });
        } catch {
            // A guard navigated away (e.g. to login) — let the next route
            // change re-evaluate the tour state.
        }

        return;
    }

    // Two nextTicks give lazy-loaded page components room to place their
    // refs; missing selectors are still filtered out afterwards in
    // useFeatureTour.
    await nextTick();
    await nextTick();

    run(segment);
}

watch(
    () => [store.status, store.activeIndex, route.name] as const,
    () => {
        void maybeProgress();
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    abort();
});
</script>

<template>
    <span aria-hidden="true" />
</template>
