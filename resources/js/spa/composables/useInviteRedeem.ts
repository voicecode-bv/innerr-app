import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/spa/http/apiClient';
import { acceptInviteLink } from '@/spa/services/inviteLinks';
import { useCirclesStore } from '@/spa/stores/circles';
import { useInviteIntentStore } from '@/spa/stores/inviteIntent';

/**
 * Call `redirectAfterAuth(fallback)` after a successful login/register/OAuth callback.
 * If there is a pending invite token (stored in localStorage or as `?invite=` query),
 * it is redeemed and the user is sent to the circle; otherwise they go to the fallback.
 */
export function useInviteRedeem() {
    const route = useRoute();
    const router = useRouter();
    const circles = useCirclesStore();
    const inviteIntent = useInviteIntentStore();

    function readToken(): string | null {
        const stored = inviteIntent.consume();

        if (stored) {
            return stored;
        }

        const fromQuery = route.query.invite;

        if (typeof fromQuery === 'string' && fromQuery.length > 0) {
            return fromQuery;
        }

        return null;
    }

    async function redirectAfterAuth(fallback: string): Promise<void> {
        const token = readToken();

        if (!token) {
            await router.push(fallback || '/');

            return;
        }

        try {
            const result = await acceptInviteLink(token);
            circles.invalidate();
            await circles.refresh();
            await router.replace(`/circles/${result.circle.id}`);
        } catch (error) {
            // 410 (expired/revoked/full) or another error — fall back to the normal redirect.
            // Clear the token explicitly so we don't keep retrying forever.
            inviteIntent.clear();

            if (!(error instanceof ApiError)) {
                throw error;
            }

            await router.push(fallback || '/');
        }
    }

    return { redirectAfterAuth };
}
