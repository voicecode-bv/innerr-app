import { describe, expect, it } from 'vitest';
import {
    firstOwnedCircleId,
    onboardingResumeNeedsCircle,
    onboardingResumeRoute,
} from './onboardingResume';

describe('onboardingResumeRoute', () => {
    it('falls back to the intro when nothing was tracked', () => {
        expect(onboardingResumeRoute(null, null)).toEqual({
            name: 'spa.onboarding.intro',
        });
        expect(onboardingResumeRoute(undefined, null)).toEqual({
            name: 'spa.onboarding.intro',
        });
    });

    it('resumes at add-children after the intro', () => {
        expect(onboardingResumeRoute('intro', 'c-1')).toEqual({
            name: 'spa.onboarding.add-children',
            params: { circle: 'c-1' },
        });
    });

    it('treats the legacy first_circle step like the intro', () => {
        expect(onboardingResumeRoute('first_circle', 'c-1')).toEqual({
            name: 'spa.onboarding.add-children',
            params: { circle: 'c-1' },
        });
    });

    it('resumes at invite-members after add_children', () => {
        expect(onboardingResumeRoute('add_children', 'c-1')).toEqual({
            name: 'spa.onboarding.invite-members',
            params: { circle: 'c-1' },
        });
    });

    it('resumes at notifications after invite_members and notifications', () => {
        expect(onboardingResumeRoute('invite_members', null)).toEqual({
            name: 'spa.onboarding.notifications',
        });
        expect(onboardingResumeRoute('notifications', null)).toEqual({
            name: 'spa.onboarding.notifications',
        });
    });

    it('falls back to the intro when a circle-bound step has no circle', () => {
        expect(onboardingResumeRoute('intro', null)).toEqual({
            name: 'spa.onboarding.intro',
        });
        expect(onboardingResumeRoute('add_children', null)).toEqual({
            name: 'spa.onboarding.intro',
        });
    });

    it('falls back to the intro on unknown step values', () => {
        expect(onboardingResumeRoute('something_new', null)).toEqual({
            name: 'spa.onboarding.intro',
        });
    });
});

describe('firstOwnedCircleId', () => {
    it('skips circles the user is merely a member of', () => {
        expect(
            firstOwnedCircleId([
                { id: 'joined', is_owner: false },
                { id: 'mine', is_owner: true },
            ]),
        ).toBe('mine');
    });

    it('returns null when the user owns no circle', () => {
        expect(firstOwnedCircleId([{ id: 'joined', is_owner: false }])).toBe(
            null,
        );
        expect(firstOwnedCircleId([])).toBe(null);
    });
});

describe('onboardingResumeNeedsCircle', () => {
    it('needs a circle for the steps that resume into circle routes', () => {
        expect(onboardingResumeNeedsCircle('intro')).toBe(true);
        expect(onboardingResumeNeedsCircle('first_circle')).toBe(true);
        expect(onboardingResumeNeedsCircle('add_children')).toBe(true);
        expect(onboardingResumeNeedsCircle('invite_members')).toBe(false);
        expect(onboardingResumeNeedsCircle(null)).toBe(false);
        expect(onboardingResumeNeedsCircle(undefined)).toBe(false);
    });
});
