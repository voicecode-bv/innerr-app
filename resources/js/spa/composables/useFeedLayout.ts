import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { externalApi } from '@/spa/http/externalApi';
import { useAuthStore } from '@/spa/stores/auth';
import type { FeedLayout } from '@/spa/stores/auth';

/**
 * Reads and persists the user's preferred home feed layout.
 *
 * The preference lives on the user profile (`feed_layout`). When it has never
 * been set it is null; we treat that as masonry by default and surface
 * `hasChosen === false` so the home feed can show its one-time chooser.
 */
export function useFeedLayout(): {
    layout: ComputedRef<FeedLayout>;
    hasChosen: ComputedRef<boolean>;
    setLayout: (next: FeedLayout) => Promise<void>;
} {
    const auth = useAuthStore();

    const hasChosen = computed(() => auth.user?.feed_layout != null);
    const layout = computed<FeedLayout>(
        () => auth.user?.feed_layout ?? 'masonry',
    );

    async function setLayout(next: FeedLayout): Promise<void> {
        // Optimistic: update locally first so the UI switches instantly; the
        // next bootstrap re-syncs from the server if the request failed.
        if (auth.user) {
            auth.user.feed_layout = next;
        }

        try {
            await externalApi.patch('/profile', { feed_layout: next });
        } catch {
            // Ignore — local state already applied; bootstrap reconciles later.
        }
    }

    return { layout, hasChosen, setLayout };
}
