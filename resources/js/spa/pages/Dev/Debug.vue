<script setup lang="ts">
import { BridgeCall } from '@nativephp/mobile';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import {
    HAS_AUTHENTICATED_KEY,
    secureStorage,
    TOKEN_KEY,
} from '@/spa/composables/useSecureStorage';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useNotificationsStore } from '@/spa/stores/notifications';
import { setBadge } from '@voicecode-bv/nativephp-badge';

// Debug page for exercising native bridge behaviour (app icon badge, background
// tasks, etc.) and inspecting what lives in secure storage. Reachable publicly
// via the hidden 10-tap gesture on the login logo, so it doubles as a way to
// diagnose token / sign-in issues on real devices. Strings are kept in English
// on purpose: this is a diagnostics screen, not part of the translated app.

const router = useRouter();
const notifications = useNotificationsStore();
const { isIos, isAndroid } = usePlatform();

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

// Token + durable markers as they currently sit in secure storage (Keychain on
// device, localStorage fallback on web). Reads go through the same retrying
// `secureStorage` helper the auth flow uses, so this reflects exactly what the
// app would restore on cold-start.
const secureToken = ref<string | null>(null);
const hasAuthenticatedMarker = ref<string | null>(null);
const loadingSecureStorage = ref(false);

async function loadSecureStorage(): Promise<void> {
    loadingSecureStorage.value = true;

    try {
        secureToken.value = await secureStorage.get(TOKEN_KEY);
        hasAuthenticatedMarker.value = await secureStorage.get(
            HAS_AUTHENTICATED_KEY,
        );
        record('Secure storage read.');
    } catch (error) {
        record(`Secure storage read failed: ${(error as Error).message}`);
    } finally {
        loadingSecureStorage.value = false;
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
                    <div>
                        <dt class="text-sand-600">
                            Has authenticated marker
                            <span class="font-mono text-xs"
                                >({{ HAS_AUTHENTICATED_KEY }})</span
                            >
                        </dt>
                        <dd
                            class="mt-1 font-mono text-xs break-all"
                            :class="
                                hasAuthenticatedMarker
                                    ? 'text-ink'
                                    : 'text-sand-600'
                            "
                        >
                            {{ hasAuthenticatedMarker ?? '— (none stored)' }}
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
