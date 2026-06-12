import { useChildFilterStore } from '@/spa/stores/childFilter';
import { usePersonsStore } from '@/spa/stores/persons';

/**
 * Builds the query string for the default feed, filtered to all available
 * children. "Children" = tagged persons without their own app account;
 * linked app users (other parents) are excluded.
 *
 * The persons list is loaded first so the filter is complete before the
 * feed is fetched. If there are no children (or loading fails), the feed
 * falls back to all posts instead of an empty list.
 */
export function useChildFeedQuery() {
    const personsStore = usePersonsStore();
    const childFilter = useChildFilterStore();

    async function childFeedQuery(page: number): Promise<string> {
        const params = new URLSearchParams();
        params.set('page', String(page));
        // Feeds are always ordered by capture date (taken_at), falling back to
        // upload date server-side for posts without an EXIF date.
        params.set('sort', 'taken_at');

        try {
            // The server-stored filter loads alongside the persons list so the
            // first feed build already uses the account-level selection;
            // ensureLoaded falls back to the warm cache when offline.
            const [persons] = await Promise.all([
                personsStore.ensureLoaded(),
                childFilter.ensureLoaded(),
            ]);
            const childIds = persons
                .filter((person) => !person.user_id)
                .map((person) => person.id);

            // An explicit selection scopes the feed to those children; otherwise
            // (empty selection) we fall back to all children. Intersect with the
            // current list so a stale id from a removed child can't blank the feed.
            const selected = childFilter.selectedIds;
            const scoped =
                selected.length > 0
                    ? childIds.filter((id) => selected.includes(id))
                    : childIds;
            const effective = scoped.length > 0 ? scoped : childIds;

            for (const id of effective) {
                params.append('person_ids[]', id);
            }
        } catch {
            // Persons list unavailable: unfiltered feed as fallback.
        }

        return params.toString();
    }

    return { childFeedQuery };
}
