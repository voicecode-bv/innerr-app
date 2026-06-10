import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';
import { useAuthStore } from '@/spa/stores/auth';

export function profileSegment(): TourSegment {
    const { t } = useTranslations();

    return {
        name: 'profile',
        routeName: 'spa.profiles.show',
        resolveParams: () => {
            const auth = useAuthStore();
            const username = auth.user?.username;

            if (!username) {
                return null;
            }

            return { username };
        },
        steps: [
            {
                element: '[data-tour="profile.header"]',
                popover: {
                    title: t('Your profile'),
                    description: t(
                        'This is what others see when they visit your profile. Tap your avatar to change it.',
                    ),
                    side: 'bottom',
                    align: 'center',
                },
            },
            {
                popover: {
                    title: t("You're all set"),
                    description: t(
                        "That's the quick tour. Share a first moment, invite people to a circle, and make Innerr yours. Got questions? Reach out any time at hallo@innerr.app.",
                    ),
                },
            },
        ],
    };
}
