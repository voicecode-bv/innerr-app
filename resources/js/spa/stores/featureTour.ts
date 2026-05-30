import { defineStore } from 'pinia';
import { getSegments } from '@/spa/featureTour';
import {
    fetchFeatureTourStatus,
    trackFeatureTourCompleted,
    trackFeatureTourSegmentCompleted,
    trackFeatureTourStarted,
} from '@/spa/http/featureTour';

type Status = 'idle' | 'running' | 'completed';

interface PersistedState {
    status: Status;
    completedSegments: string[];
    activeIndex: number;
}

const STORAGE_KEY = 'innerr.feature_tour.v1';

function readPersisted(): PersistedState | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<PersistedState>;

        if (
            parsed.status !== 'idle' &&
            parsed.status !== 'running' &&
            parsed.status !== 'completed'
        ) {
            return null;
        }

        return {
            status: parsed.status,
            completedSegments: Array.isArray(parsed.completedSegments)
                ? parsed.completedSegments.filter(
                      (s): s is string => typeof s === 'string',
                  )
                : [],
            activeIndex:
                typeof parsed.activeIndex === 'number' ? parsed.activeIndex : 0,
        };
    } catch {
        return null;
    }
}

function writePersisted(state: PersistedState): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage quota of private-mode — niet kritiek; server-state is leidend
        // zodra het endpoint live is.
    }
}

export const useFeatureTourStore = defineStore('spa-feature-tour', {
    state: () => {
        const persisted = readPersisted();

        return {
            status: (persisted?.status ?? 'idle') as Status,
            completedSegments: persisted?.completedSegments ?? [],
            activeIndex: persisted?.activeIndex ?? 0,
            // Sentinel zodat FeatureTourMount.vue eenmalig synct als de gebruiker
            // verandert (bv. logout/login).
            hydrated: false,
            // Wordt `true` zodra hydrate() de boot-beslissing heeft genomen
            // (tour gestart, voltooid, of definitief niet meer aan de beurt).
            // Consumers wachten hierop om "tour loopt nog niet" niet te verwarren
            // met "tour is al afgehandeld" — die zijn bij mount allebei `idle`.
            bootResolved: false,
        };
    },
    getters: {
        activeSegment(state) {
            const segments = getSegments();

            if (state.status !== 'running') {
                return null;
            }

            return segments[state.activeIndex] ?? null;
        },
    },
    actions: {
        persist(): void {
            writePersisted({
                status: this.status,
                completedSegments: this.completedSegments,
                activeIndex: this.activeIndex,
            });
        },
        async hydrate(): Promise<void> {
            if (this.hydrated) {
                return;
            }

            this.hydrated = true;

            try {
                const remote = await fetchFeatureTourStatus();

                if (!remote) {
                    return;
                }

                // Server is authoritatief zodra het endpoint bestaat: overschrijf
                // localStorage maar laat een lopende client-side tour (status =
                // running) ongemoeid. De gebruiker is dan midden in de tour.
                this.completedSegments = remote.segments;

                if (remote.completed_at) {
                    this.status = 'completed';
                    this.activeIndex = getSegments().length;
                    this.persist();

                    return;
                }

                // Bestaande gebruikers die de tour nog nooit gezien hebben (geen
                // server-side started_at, geen completed_at) en die nu niet midden
                // in een tour zitten: één keer automatisch aanbieden.
                if (remote.started_at === null && this.status === 'idle') {
                    this.start();

                    return;
                }

                this.persist();
            } finally {
                // Boot-beslissing genomen: status is nu definitief 'running'
                // (tour gestart) of een eindstaat. Pas hierna mogen consumers
                // een idle-status als "tour afgehandeld" lezen.
                this.bootResolved = true;
            }
        },
        start(): void {
            if (this.status === 'running') {
                return;
            }

            this.status = 'running';
            this.activeIndex = 0;
            this.persist();
            trackFeatureTourStarted();
        },
        restart(): void {
            this.status = 'running';
            this.completedSegments = [];
            this.activeIndex = 0;
            this.persist();
            trackFeatureTourStarted();
        },
        stop(): void {
            this.status = 'idle';
            this.persist();
        },
        markSegmentDone(name: string): void {
            if (!this.completedSegments.includes(name)) {
                this.completedSegments.push(name);
            }

            trackFeatureTourSegmentCompleted(name);

            const segments = getSegments();
            const nextIndex = this.activeIndex + 1;

            if (nextIndex >= segments.length) {
                this.markCompleted();

                return;
            }

            this.activeIndex = nextIndex;
            this.persist();
        },
        markCompleted(): void {
            this.status = 'completed';
            this.activeIndex = getSegments().length;
            this.persist();
            trackFeatureTourCompleted();
        },
    },
});
