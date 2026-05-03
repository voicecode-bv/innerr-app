import { On, Off, Events } from '@nativephp/mobile';
import { router } from '@inertiajs/vue3';
import { onMounted, onUnmounted } from 'vue';

export function usePushNotifications() {
    const handleToken = ({ token }) => {
        router.post(
            '/device-token',
            { token },
            { preserveState: true, preserveScroll: true },
        );
    };

    onMounted(() => On(Events.PushNotification.TokenGenerated, handleToken));
    onUnmounted(() => Off(Events.PushNotification.TokenGenerated, handleToken));
}
