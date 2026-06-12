<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { useTranslations } from '@/spa/composables/useTranslations';
import { haptics } from '@/spa/services/haptics';
import { useAuthStore } from '@/spa/stores/auth';

// Periodic retry backstop: covers the case where internet is available but the
// external API is down (the online watcher does not fire then). The `isOnline`
// watcher additionally triggers an immediate retry as soon as the device sees
// a connection again.
const RETRY_INTERVAL_MS = 8_000;

const router = useRouter();
const auth = useAuthStore();
const { t } = useTranslations();
const { isOnline } = useNetworkStatus();

const retrying = ref(false);
let intervalId: number | undefined;

async function retry(): Promise<void> {
    if (retrying.value || !auth.awaitingConnection) {
        return;
    }

    retrying.value = true;

    try {
        // If we ended up here because the Keychain was unreadable at cold
        // start, try reading it again first: if that succeeds, the bootstrap
        // below still sends a valid Bearer instead of (wrongly) logging the
        // user out.
        if (auth.storageUnavailable) {
            await auth.restoreFromStorage();
        }

        await auth.bootstrap();
    } catch {
        // Still unreachable: stay on the reconnect screen and try again on
        // the next tap or online event.
    } finally {
        retrying.value = false;
    }

    if (auth.user) {
        // Session confirmed: proceed into the app.
        await router.replace({ name: 'spa.home' }).catch(() => {});

        return;
    }

    if (!auth.awaitingConnection) {
        // Token definitively rejected (real 401): go to the welcome screen.
        await router.replace({ name: 'spa.welcome' }).catch(() => {});
    }
}

/* Haptic only for the manual tap; the interval/online-watcher retries must
   stay silent. */
function retryFromTap(): void {
    haptics.impactLight();
    void retry();
}

// Escape hatch: during a prolonged upstream outage reconnect can never
// succeed. The user may then deliberately step out via a clean logout
// (token + session removed) instead of being stuck on this screen forever.
const loggingOut = ref(false);

async function logOut(): Promise<void> {
    if (loggingOut.value) {
        return;
    }

    loggingOut.value = true;

    try {
        await auth.logout();
    } finally {
        loggingOut.value = false;
    }

    await router.replace({ name: 'spa.welcome' }).catch(() => {});
}

watch(isOnline, (online) => {
    if (online) {
        void retry();
    }
});

onMounted(() => {
    void retry();
    intervalId = window.setInterval(() => void retry(), RETRY_INTERVAL_MS);
});

onUnmounted(() => {
    if (intervalId !== undefined) {
        window.clearInterval(intervalId);
    }
});
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-sand px-8 text-center"
    >
        <span class="flex items-center gap-1" aria-hidden="true">
            <span class="dot dot-1 size-2 rounded-full bg-action"></span>
            <span class="dot dot-2 size-2 rounded-full bg-accent"></span>
            <span class="dot dot-3 size-2 rounded-full bg-sage-500"></span>
        </span>

        <div class="space-y-1.5">
            <p class="text-lg font-semibold text-brand-blue">
                {{
                    isOnline
                        ? t('Could not reach the server')
                        : t('No internet connection')
                }}
            </p>
            <p class="text-sand-600">
                {{ t('We will keep trying automatically.') }}
            </p>
        </div>

        <div class="flex flex-col items-center gap-3">
            <button
                type="button"
                :disabled="retrying"
                class="rounded-full bg-brand-blue px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                @click="retryFromTap"
            >
                {{ t('Try again') }}
            </button>

            <button
                type="button"
                :disabled="loggingOut"
                class="text-sm font-medium text-sand-600 underline underline-offset-2 disabled:opacity-60"
                @click="logOut"
            >
                {{ t('Log out') }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.dot-1 {
    animation-delay: 0s;
}
.dot-2 {
    animation-delay: 0.15s;
}
.dot-3 {
    animation-delay: 0.3s;
}
</style>
