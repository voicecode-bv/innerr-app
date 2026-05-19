import { defineStore } from 'pinia';

export type AppearanceMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'spa.appearance';
const THEME_COLOR_LIGHT = '#fcfaf3';
const THEME_COLOR_DARK = '#14172b';

function readStored(): AppearanceMode {
    if (typeof window === 'undefined') {
        return 'system';
    }

    const stored = window.localStorage?.getItem(STORAGE_KEY);

    if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
    }

    return 'system';
}

function prefersDark(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyHtmlClass(isDark: boolean): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.classList.toggle('dark', isDark);

    const meta = document.querySelector('meta[name="theme-color"]');

    if (meta) {
        meta.setAttribute('content', isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
    }
}

export const useAppearanceStore = defineStore('spa-appearance', {
    state: () => ({
        mode: 'system' as AppearanceMode,
        systemPrefersDark: false,
        mediaQueryAttached: false,
    }),
    getters: {
        isDark(state): boolean {
            if (state.mode === 'dark') {
                return true;
            }

            if (state.mode === 'light') {
                return false;
            }

            return state.systemPrefersDark;
        },
    },
    actions: {
        init(): void {
            this.mode = readStored();
            this.systemPrefersDark = prefersDark();
            applyHtmlClass(this.isDark);
            this.attachSystemListener();
        },
        set(mode: AppearanceMode): void {
            this.mode = mode;

            if (typeof window !== 'undefined') {
                window.localStorage?.setItem(STORAGE_KEY, mode);
            }

            applyHtmlClass(this.isDark);
        },
        attachSystemListener(): void {
            if (
                this.mediaQueryAttached
                || typeof window === 'undefined'
                || !window.matchMedia
            ) {
                return;
            }

            const mq = window.matchMedia('(prefers-color-scheme: dark)');

            const handler = (event: MediaQueryListEvent): void => {
                this.systemPrefersDark = event.matches;

                if (this.mode === 'system') {
                    applyHtmlClass(this.isDark);
                }
            };

            if (mq.addEventListener) {
                mq.addEventListener('change', handler);
            } else {
                mq.addListener(handler);
            }

            this.mediaQueryAttached = true;
        },
    },
});
