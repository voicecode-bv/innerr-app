import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';

export function personsSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'persons',
        routeName: 'spa.settings.persons',
        steps: [
            {
                popover: {
                    title: t('Persons vs. circles'),
                    description: t(
                        "Persons are people you tag in your photos, like your kids. They don't need an Innerr account. Circles are who you share posts with.",
                    ),
                },
            },
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
