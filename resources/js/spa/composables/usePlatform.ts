import { ref } from 'vue';
import { System } from '@nativephp/mobile';

const isIos = ref(false);
const isAndroid = ref(false);
const isMobile = ref(false);
const isReady = ref(false);
let detectionPromise: Promise<void> | null = null;

// Synchronous native-runtime signal for code that cannot wait for the async
// bridge probe (such as the router, which picks the history mode at module
// load). The NativePHP webview serves the app via php://127.0.0.1 (iOS) or
// http://127.0.0.1 (Android); web/desktop runs on a real domain. We
// deliberately do not rely on window.__nativephp — that flag is no longer
// set in the current runtime.
export function isNativeRuntime(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const { protocol, hostname } = window.location;

    return protocol === 'php:' || hostname === '127.0.0.1';
}

function detectFromUserAgent(): {
    ios: boolean;
    android: boolean;
    mobile: boolean;
} {
    if (typeof navigator === 'undefined') {
        return { ios: false, android: false, mobile: false };
    }

    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const android = /Android/i.test(ua);

    return { ios, android, mobile: ios || android };
}

async function detect(): Promise<void> {
    const fallback = detectFromUserAgent();

    try {
        const [ios, android, mobile] = await Promise.all([
            System.isIos(),
            System.isAndroid(),
            System.isMobile(),
        ]);
        isIos.value = ios || fallback.ios;
        isAndroid.value = android || fallback.android;
        isMobile.value = mobile || fallback.mobile;
    } catch {
        // No NativePHP bridge available — fall back to user-agent detection.
        isIos.value = fallback.ios;
        isAndroid.value = fallback.android;
        isMobile.value = fallback.mobile;
    } finally {
        isReady.value = true;
    }
}

export function usePlatform() {
    if (!detectionPromise) {
        detectionPromise = detect();
    }

    return {
        isIos,
        isAndroid,
        isMobile,
        isReady,
        ensureDetected: () => detectionPromise!,
    };
}
