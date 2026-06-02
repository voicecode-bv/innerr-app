import type { Directive } from 'vue';

type RevealHost = HTMLElement & { _revealObserver?: IntersectionObserver };

export const vRevealOnScroll: Directive<RevealHost> = {
    mounted(el): void {
        if (
            typeof window === 'undefined' ||
            typeof IntersectionObserver === 'undefined'
        ) {
            el.classList.add('reveal-on-scroll-in');

            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        el.classList.add('reveal-on-scroll-in');
                        observer.unobserve(el);
                    }
                }
            },
            { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
        );

        observer.observe(el);
        el._revealObserver = observer;
    },
    unmounted(el): void {
        el._revealObserver?.disconnect();
        el._revealObserver = undefined;
    },
};
