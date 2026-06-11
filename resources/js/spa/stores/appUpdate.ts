import { defineStore } from 'pinia';
import { usePlatform } from '@/spa/composables/usePlatform';
import { externalApi } from '@/spa/http/externalApi';
import { useAuthStore } from '@/spa/stores/auth';

// Store-driven update prompts. The API serves two thresholds per platform
// (managed from Filament, `GET /app-version`): `latest_version` drives the
// dismissible "update available" card, `minimum_version` drives the blocking
// "update required" screen. The current app version comes from the bootstrap
// payload (auth.appVersion).
const DISMISSED_KEY = 'spa.app-update.dismissed-version';
const CHECK_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Numeric segment-wise version compare: true when `current` is strictly older
 * than `target`. Missing segments count as 0 ('1.2' equals '1.2.0');
 * non-numeric input is treated conservatively as "not below".
 */
export function isVersionBelow(
    current: string | null | undefined,
    target: string | null | undefined,
): boolean {
    if (!current || !target) {
        return false;
    }

    const a = current.split('.').map((s) => Number.parseInt(s, 10));
    const b = target.split('.').map((s) => Number.parseInt(s, 10));

    if (a.some(Number.isNaN) || b.some(Number.isNaN)) {
        return false;
    }

    const length = Math.max(a.length, b.length);

    for (let i = 0; i < length; i++) {
        const left = a[i] ?? 0;
        const right = b[i] ?? 0;

        if (left !== right) {
            return left < right;
        }
    }

    return false;
}

function loadDismissedVersion(): string | null {
    try {
        return window.localStorage?.getItem(DISMISSED_KEY) ?? null;
    } catch {
        return null;
    }
}

export const useAppUpdateStore = defineStore('spa-app-update', {
    state: () => ({
        latestVersion: null as string | null,
        minimumVersion: null as string | null,
        storeUrl: null as string | null,
        checkedAt: 0,
        loading: null as Promise<void> | null,
        dismissedVersion: loadDismissedVersion(),
    }),
    getters: {
        updateAvailable(state): boolean {
            const current = useAuthStore().appVersion;

            return (
                isVersionBelow(current, state.latestVersion) &&
                state.dismissedVersion !== state.latestVersion
            );
        },
        updateRequired(state): boolean {
            return isVersionBelow(
                useAuthStore().appVersion,
                state.minimumVersion,
            );
        },
    },
    actions: {
        async ensureChecked(maxAgeMs: number = CHECK_TTL_MS): Promise<void> {
            if (this.checkedAt && Date.now() - this.checkedAt < maxAgeMs) {
                return;
            }

            if (this.loading) {
                return this.loading;
            }

            this.loading = (async () => {
                try {
                    const platform = await resolvePlatform();

                    if (!platform) {
                        return;
                    }

                    const resp = await externalApi.get<{
                        data: {
                            latest_version: string | null;
                            minimum_version: string | null;
                            store_url: string | null;
                        };
                    }>(`/app-version?platform=${platform}`);

                    this.latestVersion = resp.data.latest_version;
                    this.minimumVersion = resp.data.minimum_version;
                    this.storeUrl = resp.data.store_url;
                    this.checkedAt = Date.now();
                } catch {
                    // Offline or an older API without the endpoint: stay
                    // silent and retry on the next ensureChecked.
                } finally {
                    this.loading = null;
                }
            })();

            return this.loading;
        },
        dismissCurrent(): void {
            if (!this.latestVersion) {
                return;
            }

            this.dismissedVersion = this.latestVersion;

            try {
                window.localStorage?.setItem(DISMISSED_KEY, this.latestVersion);
            } catch {
                // In-memory dismissal still holds for this session.
            }
        },
    },
});

async function resolvePlatform(): Promise<'ios' | 'android' | null> {
    const { isIos, isAndroid, ensureDetected } = usePlatform();
    await ensureDetected();

    if (isIos.value) {
        return 'ios';
    }

    if (isAndroid.value) {
        return 'android';
    }

    // Web/dev build: store updates do not apply.
    return null;
}
