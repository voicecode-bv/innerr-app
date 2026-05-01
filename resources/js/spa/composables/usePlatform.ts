import { System } from '@nativephp/mobile';
import { ref } from 'vue';

const isIos = ref(false);
const isAndroid = ref(false);
const isMobile = ref(false);
const isReady = ref(false);
let detectionPromise: Promise<void> | null = null;

async function detect(): Promise<void> {
    try {
        const [ios, android, mobile] = await Promise.all([
            System.isIos(),
            System.isAndroid(),
            System.isMobile(),
        ]);
        isIos.value = ios;
        isAndroid.value = android;
        isMobile.value = mobile;
    } catch {
        // Geen NativePHP-bridge beschikbaar (browser/dev) — alle waarden blijven false.
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
