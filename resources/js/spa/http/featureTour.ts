import { externalApi } from '@/spa/http/externalApi';

export interface FeatureTourStatus {
    completed_at: string | null;
    segments: string[];
}

// Fire-and-forget: tour-tracking mag de UX nooit blokkeren. Bij netwerk- of
// 5xx-fouten verliezen we hoogstens één datapunt en valt de SPA terug op de
// localStorage-state in `stores/featureTour.ts`.
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

// Returns null wanneer het endpoint nog niet bestaat (404) of bij netwerkfout;
// caller valt dan terug op localStorage-state.
export async function fetchFeatureTourStatus(): Promise<FeatureTourStatus | null> {
    try {
        return await externalApi.get<FeatureTourStatus>('/feature-tour/status');
    } catch {
        return null;
    }
}
