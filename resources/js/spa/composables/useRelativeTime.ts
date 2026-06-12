import { useTranslations } from '@/spa/composables/useTranslations';

/**
 * Shared "x ago" formatting for post cards, post detail, and notifications.
 * Calendar-ish approximations (30-day months, 365-day years) are fine here:
 * the labels are coarse by design and only ever shown for past timestamps.
 */
export function useRelativeTime() {
    const { t } = useTranslations();

    function timeAgo(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) {
            return t('just now');
        }

        if (seconds < 3600) {
            return t(':count min ago', { count: Math.floor(seconds / 60) });
        }

        if (seconds < 86400) {
            return t(':count hours ago', {
                count: Math.floor(seconds / 3600),
            });
        }

        if (seconds < 604800) {
            const days = Math.floor(seconds / 86400);

            return t(days === 1 ? ':count day ago' : ':count days ago', {
                count: days,
            });
        }

        if (seconds < 2592000) {
            const weeks = Math.floor(seconds / 604800);

            return t(weeks === 1 ? ':count week ago' : ':count weeks ago', {
                count: weeks,
            });
        }

        if (seconds < 31536000) {
            const months = Math.floor(seconds / 2592000);

            return t(months === 1 ? ':count month ago' : ':count months ago', {
                count: months,
            });
        }

        const years = Math.floor(seconds / 31536000);

        return t(years === 1 ? ':count year ago' : ':count years ago', {
            count: years,
        });
    }

    return { timeAgo };
}
