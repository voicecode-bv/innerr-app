import { defineStore } from 'pinia';

const STORAGE_KEY = 'spa.inviteIntent.v1';
const MAX_AGE_MS = 30 * 60 * 1000;

interface PersistedIntent {
    token: string;
    storedAt: number;
}

function readPersisted(): PersistedIntent | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as PersistedIntent;

        if (
            typeof parsed?.token !== 'string' ||
            typeof parsed?.storedAt !== 'number' ||
            Date.now() - parsed.storedAt > MAX_AGE_MS
        ) {
            window.localStorage?.removeItem(STORAGE_KEY);

            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function writePersisted(intent: PersistedIntent | null): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (intent === null) {
            window.localStorage?.removeItem(STORAGE_KEY);
        } else {
            window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(intent));
        }
    } catch {
        // negeren — quotum vol of private mode
    }
}

export const useInviteIntentStore = defineStore('spa-invite-intent', {
    state: () => ({
        token: readPersisted()?.token ?? null,
    }),
    actions: {
        remember(token: string): void {
            this.token = token;
            writePersisted({ token, storedAt: Date.now() });
        },
        consume(): string | null {
            const token = this.token;
            this.token = null;
            writePersisted(null);

            return token;
        },
        clear(): void {
            this.token = null;
            writePersisted(null);
        },
    },
});
