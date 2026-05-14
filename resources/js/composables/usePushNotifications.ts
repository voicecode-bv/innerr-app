import { Events, Off, On, PushNotifications } from '@nativephp/mobile';
import { onMounted, onUnmounted, watch } from 'vue';
import { usePlatform } from '@/spa/composables/usePlatform';
import { externalApi } from '@/spa/http/externalApi';
import { useAuthStore } from '@/spa/stores/auth';

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
        const payload: { token: string; platform?: 'ios' | 'android' } = { token };

        if (platform) {
            payload.platform = platform;
        }

        await externalApi.post('/device-token', payload);
    } catch {
        // Niet kritiek; volgende app-launch of token-rotatie probeert opnieuw.
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
            // Returns de token-string zelf (of null) — niet een { token } object.
            const token = await PushNotifications.getToken();

            if (token) {
                await sendToken(token);
            }
        } catch {
            // Geen permission of bridge niet beschikbaar — niets te doen.
        }
    }

    onMounted(() => {
        On(Events.PushNotification.TokenGenerated, handleToken);
        void syncCurrentToken();
    });

    // Login binnen dezelfde session: zodra er een user verschijnt, alsnog token
    // doorzetten zonder dat de gebruiker opnieuw door onboarding hoeft.
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
