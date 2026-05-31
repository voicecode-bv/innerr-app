import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';

export function mapSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'map',
        routeName: 'spa.map',
        steps: [
            {
                popover: {
                    title: t('Photos on the map'),
                    description: t(
                        'See where your moments were taken. Tap a photo to jump straight to the post.',
                    ),
                },
            },
        ],
    };
}
