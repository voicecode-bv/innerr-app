import { describe, expect, it } from 'vitest';
import { createScrollHeaderState } from './useScrollHeader';

describe('createScrollHeaderState', () => {
    it('starts flat', () => {
        const state = createScrollHeaderState();

        expect(state.elevated.value).toBe(false);
    });

    it('elevates as soon as content scrolls under the header', () => {
        const state = createScrollHeaderState();

        state.onScrollTop(1);

        expect(state.elevated.value).toBe(true);
    });

    it('returns to flat at the top of the page', () => {
        const state = createScrollHeaderState();

        state.onScrollTop(300);
        state.onScrollTop(0);

        expect(state.elevated.value).toBe(false);
    });

    it('treats overscroll bounce as the top', () => {
        const state = createScrollHeaderState();

        state.onScrollTop(-12);

        expect(state.elevated.value).toBe(false);
    });
});
