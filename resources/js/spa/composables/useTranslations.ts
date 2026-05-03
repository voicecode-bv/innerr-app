import { computed } from 'vue';
import { useI18nStore } from '@/spa/stores/i18n';

export function useTranslations() {
    const i18n = useI18nStore();
    const locale = computed(() => i18n.locale);

    function t(
        key: string,
        replacements: Record<string, string | number> = {},
    ): string {
        return i18n.t(key, replacements);
    }

    return { t, locale };
}
