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
            // Driver.js sometimes throws during its own destroy callback;
            // ignore and let the next run clean up the DOM.
        }

        active = null;
    }
}

// Poll until one of the selectors appears in the DOM or the timeout budget
// runs out. Pages still do an async fetch after route mount (circles,
// members, profile), so `data-tour` elements only show up a few hundred ms
// later — without this wait we skipped steps and saw centered popovers
// instead of highlights.
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

        // A newer run() started during our wait (e.g. route change) —
        // abandon this run so we don't get overlapping Driver instances.
        if (token !== runToken) {
            return;
        }

        // Filter out steps whose corresponding DOM element is still missing
        // after the wait. Steps without `element` (intro/outro popovers)
        // always stay — Driver.js shows those centered.
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

        // No usable steps → mark the segment as completed right away and
        // move on to the next one; otherwise the tour gets stuck.
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
                    // User clicked X / Esc before the last step was reached
                    // — stop the tour without progress, so a restart can
                    // pick it up again.
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
