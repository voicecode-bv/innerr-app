import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/spa/http/apiClient';
import { acceptInviteLink } from '@/spa/services/inviteLinks';
import { useCirclesStore } from '@/spa/stores/circles';
import { useInviteIntentStore } from '@/spa/stores/inviteIntent';

/**
 * Roep `redirectAfterAuth(fallback)` aan na een succesvolle login/register/OAuth-callback.
 * Als er een pending invite-token is (stored in localStorage of als `?invite=` query),
 * wordt die geredeem'd en de gebruiker naar de circle gestuurd; anders gaat hij naar de fallback.
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
            // 410 (verlopen/ingetrokken/vol) of andere fout — val terug op normale redirect.
            // Token expliciet schoonmaken zodat we niet eindeloos blijven retryen.
            inviteIntent.clear();

            if (!(error instanceof ApiError)) {
                throw error;
            }

            await router.push(fallback || '/');
        }
    }

    return { redirectAfterAuth };
}
