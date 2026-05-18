import { defineStore } from 'pinia';

const loaders: Record<
    string,
    () => Promise<{ default: Record<string, string> }>
> = {
    nl: () => import('../../../../lang/nl.json'),
    en: () => import('../../../../lang/en.json'),
    fr: () => import('../../../../lang/fr.json'),
};

const cache: Record<string, Record<string, string>> = {};

async function loadBundle(locale: string): Promise<Record<string, string>> {
    const key = loaders[locale] ? locale : 'en';

    if (cache[key]) {
return cache[key];
}

    const mod = await loaders[key]();
    cache[key] = mod.default;

    return cache[key];
}

export const useI18nStore = defineStore('spa-i18n', {
    state: () => ({
        locale: 'en',
        translations: {} as Record<string, string>,
    }),
    actions: {
        async load(locale: string): Promise<void> {
            const bundle = await loadBundle(locale);
            this.locale = loaders[locale] ? locale : 'en';
            this.translations = bundle;

            if (typeof window !== 'undefined') {
                window.localStorage?.setItem('spa.locale', this.locale);
            }
        },
        set(locale: string): void {
            // Synchroon-pad voor bekende-cached locales (bv. na initial load).
            // Voor nieuwe locales valt-back op async laden via load().
            const key = loaders[locale] ? locale : 'en';

            if (cache[key]) {
                this.locale = key;
                this.translations = cache[key];

                if (typeof window !== 'undefined') {
                    window.localStorage?.setItem('spa.locale', this.locale);
                }
            } else {
                void this.load(key);
            }
        },
        t(
            key: string,
            replacements: Record<string, string | number> = {},
        ): string {
            let value = this.translations[key] ?? key;

            for (const [placeholder, replacement] of Object.entries(
                replacements,
            )) {
                value = value.replace(`:${placeholder}`, String(replacement));
            }

            return value;
        },
    },
});
