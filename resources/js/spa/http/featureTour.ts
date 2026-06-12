import { externalApi } from '@/spa/http/externalApi';

export interface FeatureTourStatus {
    started_at: string | null;
    completed_at: string | null;
    segments: string[];
}

// Fire-and-forget: tour tracking must never block the UX. On network or 5xx
// errors we lose at most one data point and the SPA falls back to the
// localStorage state in `stores/featureTour.ts`.
export function trackFeatureTourStarted(): void {
    externalApi.post('/feature-tour/started').catch(() => {});
}

export function trackFeatureTourSegmentCompleted(segment: string): void {
    externalApi
        .post(`/feature-tour/segments/${segment}/completed`)
        .catch(() => {});
}

export function trackFeatureTourCompleted(): void {
    externalApi.post('/feature-tour/completed').catch(() => {});
}

// Returns null when the endpoint does not exist yet (404) or on network
// error; the caller then falls back to localStorage state.
export async function fetchFeatureTourStatus(): Promise<FeatureTourStatus | null> {
    try {
        return await externalApi.get<FeatureTourStatus>('/feature-tour/status');
    } catch {
        return null;
    }
}
