import { useChildFilterStore } from '@/spa/stores/childFilter';
import { usePersonsStore } from '@/spa/stores/persons';

/**
 * Bouwt de query-string voor de standaard-feed, gefilterd op alle beschikbare
 * kinderen. "Kinderen" = getagde personen zonder eigen app-account; linked
 * app-gebruikers (andere ouders) vallen weg.
 *
 * De personenlijst wordt eerst geladen zodat het filter compleet is voordat de
 * feed wordt opgehaald. Zijn er geen kinderen (of faalt het laden), dan valt de
 * feed terug op alle posts in plaats van een lege lijst.
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
            const persons = await personsStore.ensureLoaded();
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
            // Personenlijst niet beschikbaar: ongefilterde feed als fallback.
        }

        return params.toString();
    }

    return { childFeedQuery };
}
