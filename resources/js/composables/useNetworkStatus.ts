import { Network } from '@nativephp/mobile';
import { onMounted, onUnmounted, ref } from 'vue';

const POLL_INTERVAL_MS = 15_000;

/**
 * Volgt de netwerkstatus via de NativePhp Network plugin (met fallback naar
 * `navigator.onLine` voor web). Levert alleen een reactive `isOnline` —
 * componenten kunnen daar zelf op reageren.
 */
export function useNetworkStatus() {
    const isOnline = ref(true);

    let intervalId: number | undefined;

    async function fetchConnected(): Promise<boolean> {
        try {
            const status = await Network.status();
            return !!status?.connected;
        } catch {
            return typeof navigator !== 'undefined' ? navigator.onLine : true;
        }
    }

    async function check(): Promise<void> {
        const connected = await fetchConnected();

        if (!connected && isOnline.value) {
            isOnline.value = false;
            return;
        }

        if (connected && !isOnline.value) {
            isOnline.value = true;
        }
    }

    function handleBrowserOnline(): void {
        isOnline.value = true;
    }

    function handleBrowserOffline(): void {
        void check();
    }

    function handleVisibilityChange(): void {
        if (document.visibilityState === 'visible') {
            void check();
        }
    }

    onMounted(() => {
        void check();
        window.addEventListener('online', handleBrowserOnline);
        window.addEventListener('offline', handleBrowserOffline);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        intervalId = window.setInterval(check, POLL_INTERVAL_MS);
    });

    onUnmounted(() => {
        if (intervalId !== undefined) {
            window.clearInterval(intervalId);
        }
        window.removeEventListener('online', handleBrowserOnline);
        window.removeEventListener('offline', handleBrowserOffline);
        document.removeEventListener(
            'visibilitychange',
            handleVisibilityChange,
        );
    });

    return { isOnline };
}
