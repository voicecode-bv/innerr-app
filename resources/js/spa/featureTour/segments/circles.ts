import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';

export function circlesSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'circles',
        routeName: 'spa.circles.index',
        steps: [
            {
                popover: {
                    title: t('What are circles?'),
                    description: t(
                        "A circle is a private group. You decide who is in it and what they can do. You'll usually have a circle for family, one for close friends, maybe one for the grandparents.",
                    ),
                },
            },
            {
                element: '[data-tour="circles.create"]',
                popover: {
                    title: t('Create a new circle'),
                    description: t(
                        'Tap here to start a new circle. Give it a name and you can invite people right after.',
                    ),
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="circles.list"]',
                popover: {
                    title: t('Your circles list'),
                    description: t(
                        'Tap any circle to open it, manage members, set permissions, or change its photo.',
                    ),
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    };
}
