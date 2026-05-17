import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';

export function mapSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'map',
        routeName: 'spa.map',
        steps: [
            {
                element: '[data-tour="map.surface"]',
                popover: {
                    title: t('Photos on the map'),
                    description: t(
                        'See where your moments were taken. Tap a photo to jump straight to the post.',
                    ),
                    side: 'bottom',
                    align: 'center',
                },
            },
        ],
    };
}
