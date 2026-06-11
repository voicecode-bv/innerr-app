import { describe, expect, it } from 'vitest';
import type { Person } from './persons';
import { isOwnChild } from './persons';

function person(overrides: Partial<Person> & { id: string }): Person {
    return {
        name: overrides.id,
        birthdate: null,
        avatar: null,
        avatar_thumbnail: null,
        usage_count: 0,
        ...overrides,
    };
}

const ME = 'user-me';
const OWNED = 'circle-owned';

describe('isOwnChild', () => {
    it('counts a child the user created even when not in the owned circle', () => {
        const child = person({
            id: 'kid',
            created_by_user_id: ME,
            circle_ids: ['circle-other'],
        });

        expect(isOwnChild(child, ME, OWNED)).toBe(true);
    });

    it('counts a child that belongs to the owned circle', () => {
        const child = person({
            id: 'kid',
            created_by_user_id: 'someone-else',
            circle_ids: [OWNED],
        });

        expect(isOwnChild(child, ME, OWNED)).toBe(true);
    });

    it('ignores account-holding member-persons', () => {
        const member = person({
            id: 'parent',
            user_id: 'other-user',
            created_by_user_id: ME,
            circle_ids: [OWNED],
        });

        expect(isOwnChild(member, ME, OWNED)).toBe(false);
    });

    it("ignores another family's child not in the owned circle", () => {
        const child = person({
            id: 'kid',
            created_by_user_id: 'someone-else',
            circle_ids: ['circle-other'],
        });

        expect(isOwnChild(child, ME, OWNED)).toBe(false);
    });

    it('does not throw when circle_ids is absent', () => {
        const child = person({ id: 'kid', created_by_user_id: ME });

        expect(isOwnChild(child, ME, OWNED)).toBe(true);
        expect(isOwnChild(child, undefined, undefined)).toBe(false);
    });
});
