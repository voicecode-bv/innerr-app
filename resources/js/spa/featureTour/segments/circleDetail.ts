import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';
import { useCirclesStore } from '@/spa/stores/circles';

export function circleDetailSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'circle-detail',
        routeName: 'spa.circles.show',
        resolveParams: () => {
            const circlesStore = useCirclesStore();
            const first = circlesStore.items?.[0];

            // No circles → skip the segment. Onboarding normally ensures at
            // least one circle, but this guards against edge cases such as
            // left-and-not-replaced.
            if (!first) {
                return null;
            }

            return { circle: first.id };
        },
        steps: [
            {
                element: '[data-tour="circle.invite"]',
                popover: {
                    title: t('Invite people'),
                    description: t(
                        'Add members by username, email, or share an invite link.',
                    ),
                    side: 'top',
                    align: 'center',
                },
            },
            {
                element: '[data-tour="circle.permissions"]',
                popover: {
                    title: t('Permissions'),
                    description: t(
                        'Decide who in this circle can invite others, view the member list, or download photos.',
                    ),
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="circle.members"]',
                popover: {
                    title: t('Members'),
                    description: t(
                        'Owners can remove members, transfer ownership, or delete the circle. Members can leave whenever they want. Nobody gets locked in.',
                    ),
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    };
}
