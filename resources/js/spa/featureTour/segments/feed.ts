import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';

export function feedSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'feed',
        routeName: 'spa.home',
        steps: [
            {
                popover: {
                    title: t('Welcome to Innerr'),
                    description: t(
                        "Quick tour: we'll walk you through the main screens so you know what's possible. You can close this at any time and restart from Settings.",
                    ),
                },
            },
            {
                element: '[data-tour="feed.circles-strip"]',
                popover: {
                    title: t('Your circles'),
                    description: t(
                        'Each circle is a private group of people you share moments with. Tap a circle to see only its posts.',
                    ),
                    side: 'bottom',
                    align: 'center',
                },
            },
            {
                element: '[data-tour="feed.children-filter"]',
                popover: {
                    title: t('Focus on one child'),
                    description: t(
                        'Tap here to choose which children to show. Your feed then narrows to just their moments. Switch back to everyone whenever you like.',
                    ),
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="feed.layout-toggle"]',
                popover: {
                    title: t('Switch the view'),
                    description: t(
                        'Switch between the classic list and a grid of your moments.',
                    ),
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="feed.notifications"]',
                popover: {
                    title: t('Notifications'),
                    description: t(
                        'New posts, likes and replies from your circles land here.',
                    ),
                    side: 'bottom',
                    align: 'end',
                },
            },
        ],
    };
}
