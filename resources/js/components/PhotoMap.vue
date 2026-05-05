<script setup lang="ts">
import type { Feature, FeatureCollection, Point } from 'geojson';
import type MapboxGlNamespace from 'mapbox-gl';
import type { GeoJSONSource, LngLatBoundsLike, MapMouseEvent } from 'mapbox-gl';
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';

interface PhotoProperties {
    post_id: string;
    media_type: 'image' | 'video';
    thumbnail_url: string | null;
    taken_at: string | null;
}

interface PhotoResponse extends FeatureCollection<Point, PhotoProperties> {
    truncated?: boolean;
}

const props = withDefaults(
    defineProps<{
        mapboxToken: string | null;
        fetchUrl: string;
        mediaType?: 'image' | 'video' | 'all';
        onPostClick?: (postId: string) => void;
    }>(),
    {
        mediaType: 'all',
        onPostClick: undefined,
    },
);

const { t } = useTranslations();

const mapContainer = useTemplateRef<HTMLDivElement>('mapContainer');
const isLoading = ref(false);
const isTruncated = ref(false);
const hasError = ref(false);

let mapboxgl: typeof MapboxGlNamespace | null = null;
let map: MapboxGlNamespace.Map | null = null;
let abortController: AbortController | null = null;
let fetchTimeout: ReturnType<typeof setTimeout> | null = null;
let didInitialFit = false;

const SOURCE_ID = 'photos';
const CLUSTER_LAYER = 'photos-clusters';
const CLUSTER_COUNT_LAYER = 'photos-cluster-count';

const photoMarkers: Record<string, MapboxGlNamespace.Marker> = {};

const NETHERLANDS_CENTER: [number, number] = [5.2913, 52.1326];
const FALLBACK_ZOOM = 6.8;

const BBOX_PADDING_RATIO = 0.35;

function currentBboxString(): string | null {
    if (!map) {
        return null;
    }

    const b = map.getBounds();

    if (!b) {
        return null;
    }

    const west = b.getWest();
    const east = b.getEast();
    const south = b.getSouth();
    const north = b.getNorth();

    const lngPad = (east - west) * BBOX_PADDING_RATIO;
    const latPad = (north - south) * BBOX_PADDING_RATIO;

    return `${west - lngPad},${south - latPad},${east + lngPad},${north + latPad}`;
}

function buildFetchUrl(bbox: string): string {
    const separator = props.fetchUrl.includes('?') ? '&' : '?';

    return `${props.fetchUrl}${separator}bbox=${encodeURIComponent(bbox)}&media_type=${props.mediaType}`;
}

async function fetchPhotos(bbox: string): Promise<PhotoResponse | null> {
    abortController?.abort();
    abortController = new AbortController();

    isLoading.value = true;
    hasError.value = false;

    try {
        const response = await fetch(buildFetchUrl(bbox), {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            signal: abortController.signal,
        });

        if (!response.ok) {
            hasError.value = true;

            return null;
        }

        return (await response.json()) as PhotoResponse;
    } catch (error) {
        if ((error as Error).name !== 'AbortError') {
            hasError.value = true;
        }

        return null;
    } finally {
        if (!abortController?.signal.aborted) {
            isLoading.value = false;
        }
    }
}

function setSourceData(data: PhotoResponse): void {
    if (!map) {
        return;
    }

    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(data);
}

function scheduleBboxFetch(): void {
    if (fetchTimeout) {
        clearTimeout(fetchTimeout);
    }

    fetchTimeout = setTimeout(async () => {
        const bbox = currentBboxString();

        if (!bbox) {
            return;
        }

        const data = await fetchPhotos(bbox);

        if (data) {
            isTruncated.value = data.truncated === true;
            setSourceData(data);
        }
    }, 300);
}

function fitToFeatures(features: Feature<Point, PhotoProperties>[]): void {
    if (!map || !mapboxgl || features.length === 0) {
        return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    features.forEach((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        bounds.extend([lng, lat]);
    });

    map.fitBounds(bounds as LngLatBoundsLike, {
        padding: 64,
        maxZoom: 12,
        duration: 0,
    });
}

async function performInitialLoad(): Promise<void> {
    const data = await fetchPhotos('-180,-90,180,90');

    if (!data || !map) {
        return;
    }

    isTruncated.value = data.truncated === true;
    setSourceData(data);

    if (data.features.length > 0) {
        fitToFeatures(data.features);
    }

    didInitialFit = true;
}

function handleClusterClick(event: MapMouseEvent): void {
    if (!map) {
        return;
    }

    const features = map.queryRenderedFeatures(event.point, {
        layers: [CLUSTER_LAYER],
    });
    const feature = features[0];

    if (!feature) {
        return;
    }

    const clusterId = feature.properties?.cluster_id as number | undefined;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;

    if (
        clusterId === undefined ||
        !source ||
        feature.geometry.type !== 'Point'
    ) {
        return;
    }

    const center = (feature.geometry as Point).coordinates as [number, number];

    source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error || !map || zoom == null) {
            return;
        }

        map.easeTo({ center, zoom });
    });
}

const VIDEO_BADGE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" /></svg>';

function createPhotoMarkerElement(properties: PhotoProperties): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-marker';
    button.setAttribute('aria-label', 'Open photo');

    if (properties.thumbnail_url) {
        button.style.backgroundImage = `url("${properties.thumbnail_url}")`;
    }

    if (properties.media_type === 'video') {
        const badge = document.createElement('span');
        badge.className = 'photo-marker__video-badge';
        badge.innerHTML = VIDEO_BADGE_SVG;
        button.appendChild(badge);
    }

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        props.onPostClick?.(properties.post_id);
    });

    return button;
}

function createClusterMarkerElement(count: number): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-marker photo-marker--cluster';
    button.setAttribute('aria-label', `Open cluster of ${count} photos`);

    const badge = document.createElement('span');
    badge.className = 'photo-marker__count-badge';
    badge.textContent = count >= 100 ? '99+' : String(count);
    button.appendChild(badge);

    return button;
}

function syncPhotoMarkers(): void {
    if (!map) {
        return;
    }

    const features = map.querySourceFeatures(SOURCE_ID);
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    const seen = new Set<string>();

    for (const feature of features) {
        const properties = feature.properties as
            | (PhotoProperties & {
                  cluster?: boolean;
                  cluster_id?: number;
                  point_count?: number;
              })
            | null;

        if (!properties || feature.geometry.type !== 'Point') {
            continue;
        }

        const coords = (feature.geometry as Point).coordinates as [
            number,
            number,
        ];

        if (properties.cluster && properties.cluster_id != null && source) {
            const id = `cluster-${properties.cluster_id}`;
            seen.add(id);

            if (photoMarkers[id]) {
                continue;
            }

            const clusterId = properties.cluster_id;
            const element = createClusterMarkerElement(
                properties.point_count ?? 0,
            );

            element.addEventListener('click', (event) => {
                event.stopPropagation();
                source.getClusterExpansionZoom(clusterId, (error, zoom) => {
                    if (error || !map || zoom == null) {
                        return;
                    }

                    map.easeTo({ center: coords, zoom });
                });
            });

            if (mapboxgl) {
                photoMarkers[id] = new mapboxgl.Marker({ element })
                    .setLngLat(coords)
                    .addTo(map);
            }

            source.getClusterLeaves(clusterId, 1, 0, (error, leaves) => {
                if (error || !leaves || leaves.length === 0) {
                    return;
                }

                const thumb = (leaves[0].properties as PhotoProperties | null)
                    ?.thumbnail_url;

                if (thumb) {
                    element.style.backgroundImage = `url("${thumb}")`;
                }
            });

            continue;
        }

        if (properties.post_id == null) {
            continue;
        }

        const id = `photo-${properties.post_id}`;
        seen.add(id);

        if (photoMarkers[id]) {
            continue;
        }

        const element = createPhotoMarkerElement(properties);
        photoMarkers[id] = new mapboxgl.Marker({ element })
            .setLngLat(coords)
            .addTo(map);
    }

    for (const id of Object.keys(photoMarkers)) {
        if (!seen.has(id)) {
            photoMarkers[id].remove();
            delete photoMarkers[id];
        }
    }
}

function clearPhotoMarkers(): void {
    for (const id of Object.keys(photoMarkers)) {
        photoMarkers[id].remove();
        delete photoMarkers[id];
    }
}

function setPointerCursor(): void {
    if (map) {
        map.getCanvas().style.cursor = 'pointer';
    }
}

function clearPointerCursor(): void {
    if (map) {
        map.getCanvas().style.cursor = '';
    }
}

function initLayers(): void {
    if (!map) {
        return;
    }

    map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
    });

    map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
            'circle-color': [
                'step',
                ['get', 'point_count'],
                '#14b8a6',
                25,
                '#0f766e',
                100,
                '#115e59',
            ],
            'circle-radius': [
                'step',
                ['get', 'point_count'],
                18,
                25,
                24,
                100,
                32,
            ],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
        },
    });

    map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 13,
        },
        paint: {
            'text-color': '#ffffff',
        },
    });

    map.on('click', CLUSTER_LAYER, handleClusterClick);
    map.on('mouseenter', CLUSTER_LAYER, setPointerCursor);
    map.on('mouseleave', CLUSTER_LAYER, clearPointerCursor);

    map.on('render', () => {
        if (map?.isSourceLoaded(SOURCE_ID)) {
            syncPhotoMarkers();
        }
    });
}

onMounted(async () => {
    if (!props.mapboxToken || !mapContainer.value) {
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
    mapboxgl.accessToken = props.mapboxToken;

    map = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: NETHERLANDS_CENTER,
        zoom: FALLBACK_ZOOM,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', async () => {
        initLayers();
        await performInitialLoad();
    });

    map.on('moveend', () => {
        if (!didInitialFit) {
            return;
        }

        scheduleBboxFetch();
    });
});

onBeforeUnmount(() => {
    if (fetchTimeout) {
        clearTimeout(fetchTimeout);
    }

    abortController?.abort();
    clearPhotoMarkers();
    map?.remove();
    map = null;
});
</script>

<template>
    <div class="relative size-full">
        <div
            v-if="!mapboxToken"
            class="flex h-full items-center justify-center p-8 text-center text-sand-600 dark:text-sand-300"
        >
            {{
                t(
                    'Mapbox token is not configured. Set MAPBOX_TOKEN in your environment.',
                )
            }}
        </div>
        <template v-else>
            <div ref="mapContainer" class="absolute! inset-0" />

            <div
                v-if="isLoading"
                class="pointer-events-none absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sand-700 shadow-sm dark:bg-sand-900/90 dark:text-sand-200"
            >
                <span class="size-2 animate-pulse rounded-full bg-teal" />
                {{ t('Loading photos...') }}
            </div>

            <div
                v-if="isTruncated && !isLoading"
                class="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1.5 text-sand-700 shadow-sm dark:bg-sand-900/90 dark:text-sand-200"
            >
                {{ t('Zoom in for more photos') }}
            </div>

            <div
                v-if="hasError && !isLoading"
                class="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-red-500/90 px-3 py-1.5 text-white shadow-sm"
            >
                {{ t('Could not load photos') }}
            </div>
        </template>
    </div>
</template>

<style>
.photo-marker {
    width: 44px;
    height: 44px;
    border-radius: 9999px;
    border: 3px solid #ffffff;
    background-color: #e5e7eb;
    background-size: cover;
    background-position: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    padding: 0;
    position: relative;
    transition: transform 120ms ease;
}

.photo-marker:hover {
    transform: scale(1.08);
}

.photo-marker__video-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    color: #ffffff;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
}

.photo-marker__video-badge svg {
    width: 100%;
    height: 100%;
}

.photo-marker--cluster {
    background-color: #14b8a6;
}

.photo-marker__count-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 9999px;
    background-color: #0f766e;
    color: #ffffff;
    font-size: 11px;
    font-weight: 600;
    line-height: 22px;
    text-align: center;
    border: 2px solid #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
</style>
