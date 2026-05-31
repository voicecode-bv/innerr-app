import { useTranslations } from '@/spa/composables/useTranslations';
import { useServiceKeysStore } from '@/spa/stores/serviceKeys';

/**
 * A normalized geocoding result. `name` is a short primary label (place or POI
 * name); `fullName` is the complete formatted place string suitable for a
 * post's free-text `location` field.
 */
export interface GeocodeResult {
    id: string;
    name: string;
    fullName: string;
    latitude: number;
    longitude: number;
}

interface MapboxFeature {
    id?: string;
    geometry?: { coordinates?: [number, number] };
    properties?: {
        mapbox_id?: string;
        name?: string;
        name_preferred?: string;
        place_formatted?: string;
        full_address?: string;
    };
}

interface MapboxGeocodeResponse {
    features?: MapboxFeature[];
}

const FORWARD_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const REVERSE_URL = 'https://api.mapbox.com/search/geocode/v6/reverse';

/**
 * Thin wrapper around the Mapbox Geocoding v6 REST API using the public token
 * already loaded by the service-keys store. All calls degrade gracefully to an
 * empty result when no token is configured or the request fails, so callers can
 * keep working with raw coordinates.
 */
export function useMapboxGeocoding() {
    const serviceKeys = useServiceKeysStore();
    const { locale } = useTranslations();

    function languageParam(): string {
        // Mapbox expects a short ISO language code (nl, en); strip any region.
        return (locale.value || 'en').split('-')[0];
    }

    function toResult(feature: MapboxFeature): GeocodeResult | null {
        const coords = feature.geometry?.coordinates;

        if (!coords || coords.length < 2) {
            return null;
        }

        const properties = feature.properties ?? {};
        const name =
            properties.name ??
            properties.name_preferred ??
            properties.full_address ??
            '';
        const fullName =
            properties.full_address ??
            (properties.name && properties.place_formatted
                ? `${properties.name}, ${properties.place_formatted}`
                : (properties.place_formatted ?? name));

        return {
            id:
                feature.id ??
                properties.mapbox_id ??
                `${coords[0]},${coords[1]}`,
            name: name || fullName,
            fullName: fullName || name,
            longitude: coords[0],
            latitude: coords[1],
        };
    }

    async function request(
        baseUrl: string,
        params: URLSearchParams,
    ): Promise<GeocodeResult[]> {
        const token = serviceKeys.mapboxToken;

        if (!token) {
            return [];
        }

        params.set('access_token', token);

        try {
            const response = await fetch(`${baseUrl}?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
                return [];
            }

            const data = (await response.json()) as MapboxGeocodeResponse;

            return (data.features ?? [])
                .map(toResult)
                .filter((result): result is GeocodeResult => result !== null);
        } catch {
            return [];
        }
    }

    /**
     * Search for places by name. Returns up to 5 ranked matches.
     */
    async function forward(
        query: string,
        options: { proximity?: { longitude: number; latitude: number } } = {},
    ): Promise<GeocodeResult[]> {
        const trimmed = query.trim();

        if (trimmed.length < 2) {
            return [];
        }

        const params = new URLSearchParams({
            q: trimmed,
            limit: '5',
            language: languageParam(),
            autocomplete: 'true',
        });

        if (options.proximity) {
            params.set(
                'proximity',
                `${options.proximity.longitude},${options.proximity.latitude}`,
            );
        }

        return request(FORWARD_URL, params);
    }

    /**
     * Resolve a readable place name for a coordinate pair.
     */
    async function reverse(
        longitude: number,
        latitude: number,
    ): Promise<GeocodeResult | null> {
        const params = new URLSearchParams({
            longitude: String(longitude),
            latitude: String(latitude),
            limit: '1',
            language: languageParam(),
        });

        const results = await request(REVERSE_URL, params);

        return results[0] ?? null;
    }

    return { forward, reverse };
}
