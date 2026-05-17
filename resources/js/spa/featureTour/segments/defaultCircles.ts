import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';

export function defaultCirclesSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'default-circles',
        routeName: 'spa.settings.default-circles',
        steps: [
            {
                popover: {
                    title: t('Default circles'),
                    description: t(
                        'These circles are pre-selected when you create a new post. Saves a few taps if you always share with the same group.',
                    ),
                },
            },
            {
                element: '[data-tour="default-circles.list"]',
                popover: {
                    title: t('Pick your defaults'),
                    description: t(
                        'Toggle the circles you usually share with. You can always change the selection per post.',
                    ),
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    };
}
