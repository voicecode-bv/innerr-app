<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAuthStore } from '@/spa/stores/auth';

// Periodieke retry-backstop: dekt het geval waarin er wél internet is maar de
// externe API plat ligt (dan vuurt de online-watcher niet). De `isOnline`-watcher
// triggert daarnaast een directe retry zodra het toestel weer verbinding ziet.
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
        // Belandden we hier omdat de Keychain bij de cold-start onleesbaar was,
        // probeer hem dan eerst opnieuw te lezen: lukt dat, dan stuurt de
        // bootstrap hieronder alsnog een geldig Bearer mee i.p.v. de gebruiker
        // (onterecht) uit te loggen.
        if (auth.storageUnavailable) {
            await auth.restoreFromStorage();
        }

        await auth.bootstrap();
    } catch {
        // Nog steeds onbereikbaar: blijf op het reconnect-scherm en probeer het
        // bij de volgende tik of online-event opnieuw.
    } finally {
        retrying.value = false;
    }

    if (auth.user) {
        // Sessie bevestigd: door naar de app.
        await router.replace({ name: 'spa.home' }).catch(() => {});

        return;
    }

    if (!auth.awaitingConnection) {
        // Token definitief afgewezen (echte 401): naar het welkomstscherm.
        await router.replace({ name: 'spa.welcome' }).catch(() => {});
    }
}

// Ontsnappingsluik: bij een aanhoudende upstream-storing kan reconnect nooit
// slagen. Dan mag de gebruiker er bewust uit stappen via een schone logout
// (token + sessie weg) i.p.v. eindeloos op dit scherm vast te zitten.
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
                class="rounded-full bg-brand-blue px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
                @click="retry"
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
