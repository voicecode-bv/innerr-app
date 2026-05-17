<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFeatureTour } from '@/spa/composables/useFeatureTour';
import { useFeatureTourStore } from '@/spa/stores/featureTour';

const route = useRoute();
const router = useRouter();
const store = useFeatureTourStore();
const { run, abort } = useFeatureTour();

// Hydrate eenmalig server-state (graceful fallback naar localStorage in de
// store als het endpoint nog niet bestaat).
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

    // Mismatch tussen actief segment en huidige route → navigeer er heen.
    // De watcher vuurt opnieuw na de route-change en valt dan in de "match"-tak.
    if (route.name !== segment.routeName) {
        abort();

        let params: Record<string, string> | null | undefined;

        if (segment.resolveParams) {
            params = segment.resolveParams();

            if (params === null) {
                // Vereiste data nog niet beschikbaar (bv. nog geen kringen) →
                // sla dit segment over zodat de tour niet vastloopt.
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
            // Guard heeft genavigeerd (bv. naar login) — laat de volgende
            // route-change de tour-state opnieuw evalueren.
        }

        return;
    }

    // Twee nextTicks geven lazy-loaded page-components ruimte om hun refs te
    // plaatsen; ontbrekende selectors filteren we daarna alsnog in useFeatureTour.
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
