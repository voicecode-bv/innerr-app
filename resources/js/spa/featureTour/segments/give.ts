import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';

export function giveSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'give',
        routeName: 'spa.settings.give',
        steps: [
            {
                element: '[data-tour="give.hero"]',
                popover: {
                    title: t('Inner Gives'),
                    description: t(
                        'Innerr donates a share of its revenue to good causes. This screen shows how it works and lets you read more.',
                    ),
                    side: 'bottom',
                    align: 'center',
                },
            },
        ],
    };
}
