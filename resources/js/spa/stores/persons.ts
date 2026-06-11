import { defineStore } from 'pinia';
import { externalApi } from '@/spa/http/externalApi';

export interface Person {
    id: string;
    name: string;
    birthdate: string | null;
    avatar: string | null;
    avatar_thumbnail: string | null;
    usage_count: number;
    user_id?: string | null;
    created_by_user_id?: string;
    circle_ids?: string[];
    parents?: {
        id: string;
        name: string;
        username: string;
        avatar_thumbnail: string | null;
    }[];
}

/**
 * Whether a person is a child the current user has added themselves.
 *
 * App-wide, an account-less person (`!user_id`) is treated as a child (see
 * Settings/Persons and the onboarding flow). The getting-started signal scopes
 * that to the owner's own children: ones they created, or ones in a circle they
 * own. Relying solely on the owned circle is too strict — a user can own several
 * circles, and a child added in onboarding need not resolve to the first one.
 */
export function isOwnChild(
    person: Person,
    userId: string | undefined,
    ownedCircleId: string | undefined,
): boolean {
    if (person.user_id) {
        return false;
    }

    return (
        (userId !== undefined && person.created_by_user_id === userId) ||
        (ownedCircleId !== undefined &&
            (person.circle_ids?.includes(ownedCircleId) ?? false))
    );
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const usePersonsStore = defineStore('spa-persons', {
    state: () => ({
        items: null as Person[] | null,
        loadedAt: 0,
        loading: null as Promise<Person[]> | null,
    }),
    actions: {
        async ensureLoaded(
            maxAgeMs: number = DEFAULT_TTL_MS,
        ): Promise<Person[]> {
            if (this.items && Date.now() - this.loadedAt < maxAgeMs) {
                return this.items;
            }

            return this.refresh();
        },
        async refresh(): Promise<Person[]> {
            if (this.loading) {
                return this.loading;
            }

            this.loading = (async () => {
                try {
                    const resp = await externalApi.get<{ data: Person[] }>(
                        '/persons',
                    );
                    this.items = resp.data;
                    this.loadedAt = Date.now();

                    return this.items;
                } finally {
                    this.loading = null;
                }
            })();

            return this.loading;
        },
        invalidate(): void {
            this.loadedAt = 0;
        },
        prepend(person: Person): void {
            this.items = [person, ...(this.items ?? [])];
        },
        update(id: string, patch: Partial<Person>): void {
            if (!this.items) {
                return;
            }

            this.items = this.items.map((p) =>
                p.id === id ? { ...p, ...patch } : p,
            );
        },
        remove(id: string): void {
            if (!this.items) {
                return;
            }

            this.items = this.items.filter((p) => p.id !== id);
        },
        clear(): void {
            this.items = null;
            this.loadedAt = 0;
        },
    },
});
