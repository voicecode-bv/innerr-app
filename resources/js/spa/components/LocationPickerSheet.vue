<script setup lang="ts">
import type MapboxGl from 'mapbox-gl';
import { ref, useTemplateRef, watch } from 'vue';
import BottomSheet from '@/components/BottomSheet.vue';
import Button from '@/components/Button.vue';
import { useMapboxGeocoding } from '@/spa/composables/useMapboxGeocoding';
import type { GeocodeResult } from '@/spa/composables/useMapboxGeocoding';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useServiceKeysStore } from '@/spa/stores/serviceKeys';

const props = defineProps<{
    open: boolean;
    latitude: number | null;
    longitude: number | null;
    location: string | null;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (
        e: 'confirm',
        value: {
            latitude: number | null;
            longitude: number | null;
            location: string | null;
        },
    ): void;
}>();

const { t } = useTranslations();
const serviceKeys = useServiceKeysStore();
const geocoding = useMapboxGeocoding();

const mapContainer = useTemplateRef<HTMLDivElement>('mapContainer');

const NETHERLANDS_CENTER: [number, number] = [5.2913, 52.1326];
const FALLBACK_ZOOM = 5;
const PLACE_ZOOM = 13;

let mapboxgl: typeof MapboxGl | null = null;
let map: InstanceType<(typeof MapboxGl)['Map']> | null = null;
let reverseTimeout: ReturnType<typeof setTimeout> | null = null;
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
// Skip the reverse-geocode that a programmatic flyTo (search result / initial
// fit) would otherwise trigger, so a chosen name is not immediately replaced.
let suppressReverse = false;

const selectedName = ref<string | null>(null);
const current = ref<{ longitude: number; latitude: number } | null>(null);
const isResolving = ref(false);

const searchQuery = ref('');
const searchResults = ref<GeocodeResult[]>([]);
const isSearching = ref(false);

const hasToken = ref<boolean>(serviceKeys.mapboxToken !== null);

function close(): void {
    emit('update:open', false);
}

function clearSearch(): void {
    searchQuery.value = '';
    searchResults.value = [];
    isSearching.value = false;

    if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
    }
}

function scheduleReverse(longitude: number, latitude: number): void {
    if (reverseTimeout) {
        clearTimeout(reverseTimeout);
    }

    isResolving.value = true;

    reverseTimeout = setTimeout(async () => {
        const result = await geocoding.reverse(longitude, latitude);

        // Ignore a stale response if the user kept panning.
        if (
            current.value?.longitude === longitude &&
            current.value?.latitude === latitude
        ) {
            selectedName.value = result?.fullName ?? null;
            isResolving.value = false;
        }
    }, 400);
}

function handleMoveEnd(): void {
    if (!map) {
        return;
    }

    const center = map.getCenter();
    current.value = { longitude: center.lng, latitude: center.lat };

    if (suppressReverse) {
        suppressReverse = false;

        return;
    }

    scheduleReverse(center.lng, center.lat);
}

async function initMap(): Promise<void> {
    const token = serviceKeys.mapboxToken;
    hasToken.value = token !== null;

    if (!token || !mapContainer.value || map) {
        return;
    }

    const [{ default: mapboxModule }] = await Promise.all([
        import('mapbox-gl'),
        import('mapbox-gl/dist/mapbox-gl.css'),
    ]);

    if (!mapContainer.value) {
        return;
    }

    mapboxgl = mapboxModule;
    mapboxgl.accessToken = token;

    const hasInitial = props.latitude !== null && props.longitude !== null;
    const center: [number, number] = hasInitial
        ? [props.longitude as number, props.latitude as number]
        : NETHERLANDS_CENTER;

    current.value = { longitude: center[0], latitude: center[1] };
    selectedName.value = props.location ?? null;

    map = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom: hasInitial ? PLACE_ZOOM : FALLBACK_ZOOM,
    });

    map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        'top-right',
    );
    map.on('moveend', handleMoveEnd);
    map.on('load', () => map?.resize());
}

function destroyMap(): void {
    if (reverseTimeout) {
        clearTimeout(reverseTimeout);
        reverseTimeout = null;
    }

    map?.remove();
    map = null;
    mapboxgl = null;
    current.value = null;
    selectedName.value = null;
    isResolving.value = false;
    clearSearch();
}

function runSearch(): void {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    const query = searchQuery.value;

    if (query.trim().length < 2) {
        searchResults.value = [];
        isSearching.value = false;

        return;
    }

    isSearching.value = true;

    searchTimeout = setTimeout(async () => {
        const results = await geocoding.forward(query, {
            proximity: current.value ?? undefined,
        });

        if (searchQuery.value === query) {
            searchResults.value = results;
            isSearching.value = false;
        }
    }, 350);
}

function selectResult(result: GeocodeResult): void {
    current.value = { longitude: result.longitude, latitude: result.latitude };
    selectedName.value = result.fullName;
    clearSearch();

    if (map) {
        suppressReverse = true;
        map.flyTo({
            center: [result.longitude, result.latitude],
            zoom: PLACE_ZOOM,
            duration: 600,
        });
    }
}

function confirm(): void {
    if (!current.value) {
        return;
    }

    emit('confirm', {
        latitude: current.value.latitude,
        longitude: current.value.longitude,
        location: selectedName.value,
    });
    close();
}

function removeLocation(): void {
    emit('confirm', { latitude: null, longitude: null, location: null });
    close();
}

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) {
            hasToken.value = serviceKeys.mapboxToken !== null;
            // Wait a frame so the sheet (and its sized container) is in the DOM.
            requestAnimationFrame(() => {
                void initMap();
            });
        } else {
            destroyMap();
        }
    },
);
</script>

<template>
    <BottomSheet :open="open" @update:open="$event || close()">
        <template #header>
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-ink">
                    {{ t('Location') }}
                </h2>
                <button
                    class="text-ink-muted"
                    :aria-label="t('Close')"
                    @click="close"
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

        <div class="px-4 py-4">
            <div
                v-if="!hasToken"
                class="flex h-64 items-center justify-center rounded-xl bg-sand-100 p-6 text-center text-sand-600"
            >
                {{
                    t(
                        'Mapbox token is not configured. Set MAPBOX_TOKEN in your environment.',
                    )
                }}
            </div>

            <template v-else>
                <div class="relative">
                    <input
                        v-model="searchQuery"
                        type="text"
                        autocomplete="off"
                        :placeholder="t('Search for a place')"
                        class="field"
                        @input="runSearch"
                    />

                    <ul
                        v-if="searchResults.length > 0"
                        class="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-sand-200 bg-surface shadow-lg"
                    >
                        <li v-for="result in searchResults" :key="result.id">
                            <button
                                type="button"
                                class="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left active:bg-sand-50"
                                @click="selectResult(result)"
                            >
                                <span class="font-medium text-ink">{{
                                    result.name
                                }}</span>
                                <span class="text-xs text-ink-muted">{{
                                    result.fullName
                                }}</span>
                            </button>
                        </li>
                    </ul>

                    <p
                        v-else-if="
                            searchQuery.trim().length >= 2 && !isSearching
                        "
                        class="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-sand-200 bg-surface px-4 py-2.5 text-ink-muted shadow-lg"
                    >
                        {{ t('No places found') }}
                    </p>
                </div>

                <div
                    class="relative mt-3 h-[42vh] min-h-[260px] overflow-hidden rounded-xl bg-sand-100"
                >
                    <div ref="mapContainer" class="absolute! inset-0" />

                    <!-- Center pin: its tip sits exactly on the map center. -->
                    <div
                        class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-action"
                        aria-hidden="true"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="size-9 drop-shadow-md"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </div>
                </div>

                <div class="mt-3 flex items-center gap-2 text-ink-muted">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.75"
                        class="size-5 shrink-0"
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
                    <span v-if="isResolving" class="text-ink-muted">{{
                        t('Finding place...')
                    }}</span>
                    <span v-else-if="selectedName" class="text-ink">{{
                        selectedName
                    }}</span>
                    <span v-else>{{ t('Drag the map to place the pin') }}</span>
                </div>
            </template>
        </div>

        <template #footer>
            <div class="flex items-center gap-3 px-4 py-3">
                <Button
                    v-if="latitude !== null && longitude !== null"
                    variant="ghost"
                    size="lg"
                    @click="removeLocation"
                >
                    {{ t('Remove location') }}
                </Button>
                <Button
                    variant="primary"
                    size="lg"
                    block
                    :disabled="!hasToken || !current"
                    @click="confirm"
                >
                    {{ t('Use this location') }}
                </Button>
            </div>
        </template>
    </BottomSheet>
</template>
