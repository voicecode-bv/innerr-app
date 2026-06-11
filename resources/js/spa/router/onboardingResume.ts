import type { RouteLocationRaw } from 'vue-router';

/* Maps the furthest completed onboarding step (as reported by the API via the
   bootstrap payload) to the route the user should resume at: the step AFTER
   the last one they finished. Unknown or missing values fall back to the
   intro, which matches the pre-resume behaviour.

   'first_circle' is a legacy step from an older flow order; users who tracked
   it resume at add-children, the step that historically followed it. */

/* The onboarding steps add children and rules to a circle, which requires
   owning it. A fresh account can already be a member of other people's
   circles (invite link redeemed before onboarding, linked OAuth account), so
   picking the first circle from the list is not safe. */
export function firstOwnedCircleId(
    circles: ReadonlyArray<{ id: string; is_owner?: boolean }>,
): string | null {
    return circles.find((circle) => circle.is_owner)?.id ?? null;
}

export function onboardingResumeNeedsCircle(
    step: string | null | undefined,
): boolean {
    return (
        step === 'intro' ||
        step === 'first_circle' ||
        step === 'add_children' ||
        step === 'first_moment'
    );
}

export function onboardingResumeRoute(
    step: string | null | undefined,
    circleId: string | null,
): RouteLocationRaw {
    switch (step) {
        case 'intro':
        case 'first_circle':
            return circleId
                ? {
                      name: 'spa.onboarding.add-children',
                      params: { circle: circleId },
                  }
                : { name: 'spa.onboarding.intro' };
        case 'add_children':
            return circleId
                ? {
                      name: 'spa.onboarding.first-moment',
                      params: { circle: circleId },
                  }
                : { name: 'spa.onboarding.intro' };
        case 'first_moment':
            return circleId
                ? {
                      name: 'spa.onboarding.invite-members',
                      params: { circle: circleId },
                  }
                : { name: 'spa.onboarding.intro' };
        case 'invite_members':
        case 'notifications':
            return { name: 'spa.onboarding.notifications' };
        default:
            return { name: 'spa.onboarding.intro' };
    }
}
