import { driver } from 'driver.js';
import type { Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '@/spa/featureTour/theme.css';
import { useTranslations } from '@/spa/composables/useTranslations';
import type { TourSegment } from '@/spa/featureTour';
import { useFeatureTourStore } from '@/spa/stores/featureTour';

let active: Driver | null = null;
let runToken = 0;

function destroyActive(): void {
    if (active) {
        try {
            active.destroy();
        } catch {
            // Driver.js gooit soms tijdens de eigen destroy-callback;
            // negeer en laat de DOM opruimen door de volgende run.
        }

        active = null;
    }
}

// Poll tot een van de selectors in de DOM verschijnt of het timeout-budget op
// is. Pages doen na route-mount nog een async fetch (kringen, leden, profiel)
// waardoor `data-tour` elementen pas een paar honderd ms later aanwezig zijn —
// zonder deze wait sloegen we steps over en zagen we centrale popovers in
// plaats van highlights.
async function waitForAnySelector(
    selectors: string[],
    timeoutMs = 2500,
): Promise<void> {
    if (selectors.length === 0) {
        return;
    }

    const start = performance.now();

    while (performance.now() - start < timeoutMs) {
        if (selectors.some((s) => document.querySelector(s) !== null)) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

export function useFeatureTour() {
    const { t } = useTranslations();
    const store = useFeatureTourStore();

    async function run(segment: TourSegment): Promise<void> {
        destroyActive();

        const token = ++runToken;

        const elementSelectors = segment.steps
            .map((step) =>
                typeof step.element === 'string' ? step.element : null,
            )
            .filter((s): s is string => s !== null);

        await waitForAnySelector(elementSelectors);

        // Een nieuwere run() is gestart tijdens onze wait (bv. route-change) —
        // staak deze run zodat we geen overlappende Driver-instanties krijgen.
        if (token !== runToken) {
            return;
        }

        // Filter steps waarvan het bijbehorende DOM-element nog steeds ontbreekt
        // ná de wait. Steps zonder `element` (intro/outro popovers) blijven
        // altijd staan — die toont Driver.js in het midden.
        const usableSteps = segment.steps.filter((step) => {
            const selector = step.element;

            if (typeof selector !== 'string') {
                return true;
            }

            const exists = document.querySelector(selector) !== null;

            if (!exists && import.meta.env.DEV) {
                console.warn(
                    `[featureTour] step skipped — selector not found: ${selector}`,
                );
            }

            return exists;
        });

        // Geen bruikbare stappen → markeer segment direct als voltooid en ga
        // door naar het volgende; anders blijft de tour vastzitten.
        if (usableSteps.length === 0) {
            store.markSegmentDone(segment.name);

            return;
        }

        let completedNormally = false;

        active = driver({
            showProgress: true,
            allowClose: true,
            overlayOpacity: 0.55,
            stagePadding: 6,
            stageRadius: 12,
            popoverClass: 'innerr-tour',
            progressText: t('Step {{current}} of {{total}}'),
            nextBtnText: t('Next'),
            prevBtnText: t('Back'),
            doneBtnText: t('Continue'),
            steps: usableSteps,
            onDestroyStarted: (_element, _step, opts) => {
                const drv = opts.driver;

                if (drv.isLastStep() || !drv.hasNextStep()) {
                    completedNormally = true;
                }

                drv.destroy();
            },
            onDestroyed: () => {
                active = null;

                if (completedNormally) {
                    store.markSegmentDone(segment.name);
                } else {
                    // Gebruiker klikte op X / Esc voordat de laatste stap was
                    // bereikt — stop de tour zonder progress, zodat een restart
                    // hem weer kan oppakken.
                    store.stop();
                }
            },
        });

        active.drive();
    }

    function abort(): void {
        destroyActive();
    }

    return { run, abort };
}
