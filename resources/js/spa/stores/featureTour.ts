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
        // Storage quota or private mode — not critical; server state is the
        // source of truth once the endpoint is live.
    }
}

export const useFeatureTourStore = defineStore('spa-feature-tour', {
    state: () => {
        const persisted = readPersisted();

        return {
            status: (persisted?.status ?? 'idle') as Status,
            completedSegments: persisted?.completedSegments ?? [],
            activeIndex: persisted?.activeIndex ?? 0,
            // Sentinel so FeatureTourMount.vue syncs once when the user
            // changes (e.g. logout/login).
            hydrated: false,
            // Becomes `true` once hydrate() has made the boot decision (tour
            // started, completed, or definitively no longer due). Consumers
            // wait on this to avoid confusing "tour not running yet" with
            // "tour already handled" — both are `idle` at mount.
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

                // The server is authoritative once the endpoint exists:
                // overwrite localStorage but leave a running client-side tour
                // (status = running) untouched. The user is then mid-tour.
                this.completedSegments = remote.segments;

                if (remote.completed_at) {
                    this.status = 'completed';
                    this.activeIndex = getSegments().length;
                    this.persist();

                    return;
                }

                // Existing users who have never seen the tour (no server-side
                // started_at, no completed_at) and who are not currently
                // mid-tour: offer it automatically once.
                if (remote.started_at === null && this.status === 'idle') {
                    this.start();

                    return;
                }

                this.persist();
            } finally {
                // Boot decision made: the status is now definitively 'running'
                // (tour started) or a final state. Only after this may
                // consumers read an idle status as "tour handled".
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
