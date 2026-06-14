import { useTranslations } from '@/spa/composables/useTranslations';

/**
 * Display-only localization of Printdeal vocabulary (attribute names like
 * 'Print Area', values like 'Box With Printed Sleeve'). The API only speaks
 * English; known terms translate through the lang bundles, sizes like
 * '54 x 40 cm (500 pcs)' get their unit localized, and anything unknown
 * falls back to the English original. The original strings are what gets
 * sent to the API; never feed translated terms back.
 */
export function usePrintTerms() {
    const { t } = useTranslations();

    function printTerm(raw: string): string {
        const translated = t(raw);

        if (translated !== raw) {
            return translated;
        }

        // '(500 pcs)' reads as '(500 stukjes)' / '(500 pièces)'.
        return raw.replace(
            /\((\d+)\s*pcs\)/,
            (_, count: string) => `(${count} ${t('pcs')})`,
        );
    }

    return { printTerm };
}
