<script setup lang="ts">
import { BridgeCall } from '@nativephp/mobile';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { secureStorage, TOKEN_KEY } from '@/spa/composables/useSecureStorage';
import { api } from '@/spa/http/apiClient';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { sendSupportRequest } from '@/spa/services/support';
import { useAuthStore } from '@/spa/stores/auth';
import { useNotificationsStore } from '@/spa/stores/notifications';
import { setBadge } from '@voicecode-bv/nativephp-badge';

// Debug page for exercising native bridge behaviour (app icon badge, background
// tasks, etc.) and inspecting what lives in secure storage. Reachable publicly
// via the hidden 10-tap gesture on the login logo, so it doubles as a way to
// diagnose token / sign-in issues on real devices. Strings are kept in English
// on purpose: this is a diagnostics screen, not part of the translated app.

const router = useRouter();
const auth = useAuthStore();
const notifications = useNotificationsStore();
const { isIos, isAndroid, ensureDetected } = usePlatform();

function resolvePlatform(): 'ios' | 'android' | 'web' {
    if (isIos.value) {
        return 'ios';
    }

    if (isAndroid.value) {
        return 'android';
    }

    return 'web';
}

const platformLabel = computed(() => {
    if (isIos.value) {
        return 'iOS';
    }

    if (isAndroid.value) {
        return 'Android';
    }

    return 'Web / desktop (native bridge unavailable)';
});

const log = ref<string[]>([]);

function record(message: string): void {
    const time = new Date().toLocaleTimeString();
    log.value.unshift(`[${time}] ${message}`);
}

async function applyBadge(count: number): Promise<void> {
    try {
        await setBadge(count);
        record(`setBadge(${count}) resolved.`);
    } catch (error) {
        record(`setBadge(${count}) rejected: ${(error as Error).message}`);
    }
}

function clearViaStore(): void {
    notifications.clear();
    record('notifications.clear() called (sets badge to 0 via store).');
}

const runningBackgroundTasks = ref(false);

// JS equivalent of the PHP facade `BackgroundTasks::runNow()`, which itself
// just calls `nativephp_call('BackgroundTasks.RunNow', '{}')`. Requires the
// BackgroundTasks plugin to be enabled in NativeServiceProvider and a native
// rebuild; otherwise the bridge rejects with "method not found".
async function runBackgroundTasksNow(): Promise<void> {
    runningBackgroundTasks.value = true;

    try {
        const result = await BridgeCall('BackgroundTasks.RunNow', {});
        record(`BackgroundTasks.RunNow resolved: ${JSON.stringify(result)}`);
    } catch (error) {
        record(`BackgroundTasks.RunNow rejected: ${(error as Error).message}`);
    } finally {
        runningBackgroundTasks.value = false;
    }
}

// Token as it currently sits in secure storage (Keychain on device, localStorage
// fallback on web). Reads go through the same retrying `secureStorage` helper the
// auth flow uses, so this reflects exactly what the app would restore on
// cold-start.
const secureToken = ref<string | null>(null);
const loadingSecureStorage = ref(false);

async function loadSecureStorage(): Promise<void> {
    loadingSecureStorage.value = true;

    try {
        secureToken.value = await secureStorage.get(TOKEN_KEY);
        record('Secure storage read.');
    } catch (error) {
        record(`Secure storage read failed: ${(error as Error).message}`);
    } finally {
        loadingSecureStorage.value = false;
    }
}

// Vergeet de BFF-session server-side maar laat het token in de Keychain staan.
// Bootst "sessie weg, token nog geldig" na: zet hierna vliegtuigmodus aan en
// herstart de app om het reconnect-scherm te testen zonder herinstall.
const forgettingSession = ref(false);

async function forgetSession(): Promise<void> {
    forgettingSession.value = true;

    try {
        await api.post('/api/spa/debug/forget-session');
        record(
            'BFF session forgotten (token kept). Enable airplane mode and relaunch to hit the reconnect screen.',
        );
    } catch (error) {
        record(`forget-session rejected: ${(error as Error).message}`);
    } finally {
        forgettingSession.value = false;
    }
}

// Email a dump of the BFF Laravel session + held token, plus the client-side
// secure-storage state, to the support inbox (hallo@innerr.app) by reusing the
// same support endpoint as the Settings > Support screen. Lets us inspect a
// real device's auth state without physical access.
interface SessionDump {
    session_id: string | null;
    session: Record<string, unknown>;
    server_token: string | null;
    auth_status: string;
    user: { id: string; email: string; username: string } | null;
}

const sendingDump = ref(false);

async function emailDiagnostics(): Promise<void> {
    sendingDump.value = true;

    try {
        const dump = await api.get<SessionDump>('/api/spa/debug/session-dump');

        const lines = [
            `Platform: ${platformLabel.value}`,
            `App version: ${auth.appVersion || 'unknown'}`,
            `Auth status (BFF): ${dump.auth_status}`,
            `Session id: ${dump.session_id ?? '—'}`,
            `User: ${dump.user ? `${dump.user.username} <${dump.user.email}> (${dump.user.id})` : '—'}`,
            '',
            `Client secure-storage token: ${secureToken.value ?? '— (none stored)'}`,
            `Server-held token (BFF): ${dump.server_token ?? '— (none stored)'}`,
            '',
            'Laravel session:',
            JSON.stringify(dump.session, null, 2),
        ];

        // The support endpoint caps the message at 5000 characters.
        const message = lines.join('\n').slice(0, 5000);

        await ensureDetected();
        await sendSupportRequest(message, auth.appVersion, resolvePlatform());

        record('Session + token dump emailed to hallo@innerr.app.');
    } catch (error) {
        record(`Dump email failed: ${(error as Error).message}`);
    } finally {
        sendingDump.value = false;
    }
}

async function copyToken(): Promise<void> {
    if (!secureToken.value) {
        return;
    }

    try {
        await navigator.clipboard.writeText(secureToken.value);
        record('Token copied to clipboard.');
    } catch (error) {
        record(`Copy failed: ${(error as Error).message}`);
    }
}

onMounted(loadSecureStorage);

function goBack(): void {
    router.back();
}
</script>

<template>
    <AppLayout title="Debug">
        <template #header-left>
            <button class="flex items-center text-ink" @click="goBack">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>
        </template>

        <div class="mt-10 space-y-4 px-4 pt-4 pb-24">
            <p class="text-sm text-sand-600">
                Diagnostics page for inspecting secure storage and exercising
                native bridge calls. Results are appended to the call log below.
            </p>

            <div class="rounded-lg border border-dark-sand bg-surface p-4">
                <dl class="space-y-1 text-sm">
                    <div class="flex justify-between gap-4">
                        <dt class="text-sand-600">Platform</dt>
                        <dd class="text-right font-medium text-ink">
                            {{ platformLabel }}
                        </dd>
                    </div>
                    <div class="flex justify-between gap-4">
                        <dt class="text-sand-600">Store unread count</dt>
                        <dd class="font-medium text-ink">
                            {{ notifications.unreadCount }}
                        </dd>
                    </div>
                </dl>
            </div>

            <div class="rounded-lg border border-dark-sand bg-surface p-4">
                <div class="mb-3 flex items-center justify-between gap-2">
                    <h2 class="text-sm font-semibold text-ink">
                        Secure storage
                    </h2>
                    <button
                        class="text-xs font-medium text-brand-blue underline disabled:opacity-50"
                        :disabled="loadingSecureStorage"
                        @click="loadSecureStorage"
                    >
                        {{ loadingSecureStorage ? 'Loading…' : 'Refresh' }}
                    </button>
                </div>
                <dl class="space-y-3 text-sm">
                    <div>
                        <dt class="text-sand-600">
                            API token
                            <span class="font-mono text-xs"
                                >({{ TOKEN_KEY }})</span
                            >
                        </dt>
                        <dd
                            class="mt-1 font-mono text-xs break-all"
                            :class="secureToken ? 'text-ink' : 'text-sand-600'"
                        >
                            {{ secureToken ?? '— (none stored)' }}
                        </dd>
                    </div>
                </dl>
                <Button
                    v-if="secureToken"
                    block
                    variant="secondary"
                    class="mt-3"
                    @click="copyToken"
                >
                    Copy token
                </Button>
            </div>

            <div class="space-y-2">
                <h2 class="text-sm font-semibold text-ink">
                    Diagnostics email
                </h2>
                <Button block :disabled="sendingDump" @click="emailDiagnostics">
                    {{
                        sendingDump
                            ? 'Sending…'
                            : 'Email session + token dump to support'
                    }}
                </Button>
                <p class="text-xs text-sand-600">
                    Sends the Laravel session and API token (client + server) to
                    hallo@innerr.app via the support inbox.
                </p>
            </div>

            <div class="space-y-2">
                <h2 class="text-sm font-semibold text-ink">Reconnect test</h2>
                <Button
                    block
                    variant="danger"
                    :disabled="forgettingSession"
                    @click="forgetSession"
                >
                    {{
                        forgettingSession
                            ? 'Forgetting…'
                            : 'Forget BFF session (keep token)'
                    }}
                </Button>
                <p class="text-xs text-sand-600">
                    Clears the local Laravel session but keeps the API token.
                    Turn on airplane mode and relaunch to land on the reconnect
                    screen.
                </p>
            </div>

            <div class="space-y-2">
                <h2 class="text-sm font-semibold text-ink">App icon badge</h2>
                <Button block @click="applyBadge(5)">Set badge to 5</Button>
                <Button block @click="applyBadge(1)">Set badge to 1</Button>
                <Button block variant="danger" @click="applyBadge(0)">
                    Reset badge to 0
                </Button>
                <Button block variant="secondary" @click="clearViaStore">
                    Reset via notifications store
                </Button>
            </div>

            <div class="space-y-2">
                <h2 class="text-sm font-semibold text-ink">Background tasks</h2>
                <Button
                    block
                    :disabled="runningBackgroundTasks"
                    @click="runBackgroundTasksNow"
                >
                    {{
                        runningBackgroundTasks
                            ? 'Running…'
                            : 'Run background tasks now'
                    }}
                </Button>
            </div>

            <div class="rounded-lg border border-dark-sand bg-surface p-4">
                <h2 class="mb-2 text-sm font-semibold text-ink">Call log</h2>
                <p v-if="log.length === 0" class="text-sm text-sand-600">
                    No calls yet.
                </p>
                <ul v-else class="space-y-1">
                    <li
                        v-for="(entry, index) in log"
                        :key="index"
                        class="font-mono text-xs break-words text-ink"
                    >
                        {{ entry }}
                    </li>
                </ul>
            </div>
        </div>
    </AppLayout>
</template>
