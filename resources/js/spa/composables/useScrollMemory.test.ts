import { beforeEach, describe, expect, it } from 'vitest';
import { forgetScroll, recallScroll, rememberScroll } from './useScrollMemory';

describe('useScrollMemory', () => {
    beforeEach(() => {
        forgetScroll('spa.home');
        forgetScroll('spa.home.grid');
    });

    it('returns undefined for a key that was never stored', () => {
        expect(recallScroll('spa.home')).toBeUndefined();
    });

    it('remembers and recalls a scroll position', () => {
        rememberScroll('spa.home', 1234);

        expect(recallScroll('spa.home')).toBe(1234);
    });

    it('keeps positions independent per key', () => {
        rememberScroll('spa.home', 100);
        rememberScroll('spa.home.grid', 900);

        expect(recallScroll('spa.home')).toBe(100);
        expect(recallScroll('spa.home.grid')).toBe(900);
    });

    it('overwrites a previous position for the same key', () => {
        rememberScroll('spa.home', 100);
        rememberScroll('spa.home', 250);

        expect(recallScroll('spa.home')).toBe(250);
    });

    it('forgets a stored position', () => {
        rememberScroll('spa.home', 100);
        forgetScroll('spa.home');

        expect(recallScroll('spa.home')).toBeUndefined();
    });
});
