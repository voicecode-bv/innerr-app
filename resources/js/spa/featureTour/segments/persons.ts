import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';

export function personsSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'persons',
        routeName: 'spa.settings.persons',
        steps: [
            {
                element: '[data-tour="persons.list"]',
                popover: {
                    title: t('Your persons'),
                    description: t(
                        'Add a name and a birth date so Innerr can show their age at the time of each photo.',
                    ),
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    };
}
