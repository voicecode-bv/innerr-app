import { onMounted, onUnmounted, watch } from 'vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { externalApi } from '@/spa/http/externalApi';
import { useAuthStore } from '@/spa/stores/auth';
import { Events, Off, On, PushNotifications } from '@nativephp/mobile';

async function resolvePlatform(): Promise<'ios' | 'android' | null> {
    const { isIos, isAndroid, ensureDetected } = usePlatform();

    await ensureDetected();

    if (isIos.value) {
        return 'ios';
    }

    if (isAndroid.value) {
        return 'android';
    }

    return null;
}

async function sendToken(token: string): Promise<void> {
    try {
        const platform = await resolvePlatform();
        const payload: { token: string; platform?: 'ios' | 'android' } = {
            token,
        };

        if (platform) {
            payload.platform = platform;
        }

        await externalApi.post('/device-token', payload);
    } catch {
        // Not critical; the next app launch or token rotation retries.
    }
}

export function usePushNotifications(): void {
    const auth = useAuthStore();

    const handleToken = ({ token }: { token: string }) => {
        if (token) {
            void sendToken(token);
        }
    };

    async function syncCurrentToken(): Promise<void> {
        if (!auth.user || !auth.token) {
            return;
        }

        try {
            // Returns the token string itself (or null) — not a { token } object.
            const token = await PushNotifications.getToken();

            if (token) {
                await sendToken(token);
            }
        } catch {
            // No permission or bridge unavailable — nothing to do.
        }
    }

    onMounted(() => {
        On(Events.PushNotification.TokenGenerated, handleToken);
        void syncCurrentToken();
    });

    // Login within the same session: as soon as a user appears, forward the
    // token anyway without the user having to go through onboarding again.
    const stopWatcher = watch(
        () => auth.user?.id ?? null,
        (newId, oldId) => {
            if (newId && newId !== oldId) {
                void syncCurrentToken();
            }
        },
    );

    onUnmounted(() => {
        Off(Events.PushNotification.TokenGenerated, handleToken);
        stopWatcher();
    });
}
