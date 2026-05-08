import { externalApi } from '@/spa/http/externalApi';

export type OnboardingStep =
    | 'intro'
    | 'first_circle'
    | 'invite_members'
    | 'notifications';

// Fire-and-forget: het tracken van een stap mag de onboarding-flow niet
// blokkeren. Bij netwerkfout / 5xx verloren we hoogstens één datapunt; de
// gebruiker merkt er niets van.
export function trackOnboardingStep(step: OnboardingStep): void {
    externalApi.post('/onboarding/steps', { step }).catch(() => {});
}
