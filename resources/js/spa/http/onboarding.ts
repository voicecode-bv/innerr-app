import { externalApi } from '@/spa/http/externalApi';

export type OnboardingStep =
    | 'intro'
    | 'add_children'
    | 'first_moment'
    | 'invite_members'
    | 'notifications';

// Fire-and-forget: tracking a step must not block the onboarding flow. On a
// network error / 5xx we lose at most one data point; the user notices
// nothing.
export function trackOnboardingStep(step: OnboardingStep): void {
    externalApi.post('/onboarding/steps', { step }).catch(() => {});
}
