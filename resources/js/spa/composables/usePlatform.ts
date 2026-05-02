import { System } from '@nativephp/mobile';
import { ref } from 'vue';

const isIos = ref(false);
const isAndroid = ref(false);
const isMobile = ref(false);
const isReady = ref(false);
let detectionPromise: Promise<void> | null = null;

function detectFromUserAgent(): { ios: boolean; android: boolean; mobile: boolean } {
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
        // Geen NativePHP-bridge beschikbaar — val terug op user-agent-detectie.
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
    return { isIos, isAndroid, isMobile, isReady, ensureDetected: () => detectionPromise! };
}
