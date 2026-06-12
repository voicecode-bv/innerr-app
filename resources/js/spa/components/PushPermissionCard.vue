<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Spinner from '@/components/Spinner.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { Events, Off, On, PushNotifications } from '@nativephp/mobile';
import bellIcon from '../../../svg/doodle-icons/bell.svg';
import infoIcon from '../../../svg/doodle-icons/Info.svg';

type PermissionStatus =
    | 'granted'
    | 'denied'
    | 'not_determined'
    | 'provisional'
    | 'ephemeral'
    | null;

const props = withDefaults(
    defineProps<{
        // When true a close button appears and the choice is persisted in
        // localStorage, so the card never returns in that spot. Where the
        // page itself is the primary subject (e.g. Settings) keep this false.
        dismissible?: boolean;
    }>(),
    { dismissible: false },
);

// Fires after the user has answered the native permission prompt (granted
// or denied) so a parent can react — e.g. refresh a feed.
const emit = defineEmits<{
    'permission-changed': [PermissionStatus];
}>();

const DISMISSED_STORAGE_KEY = 'spa.push-permission-card.dismissed';

const { t } = useTranslations();

const permissionStatus = ref<PermissionStatus>(null);
const enrolling = ref(false);
const dismissed = ref(
    typeof window !== 'undefined' &&
        window.localStorage?.getItem(DISMISSED_STORAGE_KEY) === '1',
);

const showDeniedBanner = computed(() => permissionStatus.value === 'denied');
const showEnablePrompt = computed(
    () => permissionStatus.value === 'not_determined',
);
const hasBanner = computed(
    () =>
        (showDeniedBanner.value || showEnablePrompt.value) &&
        !(props.dismissible && dismissed.value),
);

function dismiss(): void {
    dismissed.value = true;

    try {
        window.localStorage?.setItem(DISMISSED_STORAGE_KEY, '1');
    } catch {
        // localStorage can fail in private mode or on quota issues — only the
        // in-memory state remains then, which is enough for this session.
    }
}

function iconMaskStyle(url: string) {
    return {
        maskImage: `url(${url})`,
        WebkitMaskImage: `url(${url})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
    };
}

async function refreshStatus(): Promise<void> {
    try {
        const status = (await PushNotifications.checkPermission()) as
            | PermissionStatus
            | string;
        permissionStatus.value = (status ?? null) as PermissionStatus;
    } catch {
        permissionStatus.value = null;
    }
}

// iOS keeps reporting the old permission for a moment after the prompt
// closes, and getToken() can still be null right after enroll. Poll a few
// times so the card dismisses itself without needing an app relaunch.
let statusRetryTimers: number[] = [];

function clearStatusRetries(): void {
    statusRetryTimers.forEach((timer) => window.clearTimeout(timer));
    statusRetryTimers = [];
}

function scheduleStatusRetries(): void {
    clearStatusRetries();
    statusRetryTimers = [800, 2000, 4500].map((delay) =>
        window.setTimeout(() => {
            if (permissionStatus.value === 'not_determined') {
                void refreshStatus();
            }
        }, delay),
    );
}

// An FCM token is only ever issued after permission was granted, so the
// event is a definitive "enabled" signal regardless of where the user
// enabled it (this card, the onboarding step, or the system settings).
function onTokenGenerated({ token }: { token: string }): void {
    if (token && permissionStatus.value !== 'granted') {
        permissionStatus.value = 'granted';
        emit('permission-changed', 'granted');
    }
}

async function enablePushNotifications(): Promise<void> {
    if (enrolling.value) {
        return;
    }

    enrolling.value = true;

    try {
        await PushNotifications.enroll();
        // getToken() yields the token string itself (or null) — not { token }.
        const token = await PushNotifications.getToken();

        if (token) {
            try {
                await externalApi.post('/device-token', { token });
            } catch {
                // Not critical; usePushNotifications retries on the next launch.
            }

            // FCM only issues a token after the user has granted permission.
            // The native checkPermission status is sometimes not yet updated
            // right after enroll ('not_determined'), which left the banner in
            // place until a later refresh. With a token we know for sure push
            // is on, so we set the status ourselves here so the banner
            // disappears immediately.
            permissionStatus.value = 'granted';
        } else {
            // No token: denied or still undecided — read the real status.
            await refreshStatus();
            scheduleStatusRetries();
        }
    } catch {
        // The user denied or the bridge is unavailable.
        await refreshStatus();
        scheduleStatusRetries();
    } finally {
        enrolling.value = false;
        emit('permission-changed', permissionStatus.value);
    }
}

// Re-check the status when the user returns from the native settings, so
// the banner adapts without an app restart.
function onVisibilityChange(): void {
    if (typeof document !== 'undefined' && !document.hidden) {
        void refreshStatus();
    }
}

onMounted(() => {
    void refreshStatus();
    On(Events.PushNotification.TokenGenerated, onTokenGenerated);

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
    }
});

onBeforeUnmount(() => {
    clearStatusRetries();
    Off(Events.PushNotification.TokenGenerated, onTokenGenerated);

    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }
});

defineExpose({ refresh: refreshStatus });
</script>

<template>
    <div
        v-if="hasBanner"
        class="reveal-item relative overflow-hidden rounded-2xl bg-surface/80 p-5 shadow-sm ring-1 ring-sand-200/70 backdrop-blur-sm"
    >
        <!-- Corner glow + film grain: the same album-note atmosphere as the
             welcome scene, so prompts feel like part of the product. -->
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
            <div
                class="absolute -top-10 -right-8 size-32 rounded-full bg-accent-soft/25 blur-2xl"
            ></div>
            <div class="absolute inset-0 grain opacity-[0.04]"></div>
        </div>

        <button
            v-if="dismissible"
            type="button"
            class="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-brand-blue/60 transition-colors hover:bg-brand-blue/10 hover:text-brand-blue dark:text-ink-muted"
            :aria-label="t('Dismiss')"
            @click="dismiss"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="size-4"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                />
            </svg>
        </button>

        <div v-if="showDeniedBanner" class="relative flex items-start gap-4">
            <div
                class="flex size-12 shrink-0 rotate-[-6deg] items-center justify-center rounded-xl bg-sand-100 text-ink shadow-sm"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6 bg-current"
                    :style="iconMaskStyle(infoIcon)"
                ></span>
            </div>
            <div class="flex-1" :class="dismissible ? 'pr-6' : ''">
                <h3 class="font-semibold text-ink">
                    {{ t('Push notifications are off') }}
                </h3>
                <p class="mt-1 text-sm leading-relaxed text-ink-muted">
                    {{
                        t(
                            'You disabled push notifications for this app on your device. Open your device settings to turn them back on.',
                        )
                    }}
                </p>
            </div>
        </div>

        <div
            v-else-if="showEnablePrompt"
            class="relative flex items-start gap-4"
        >
            <div class="relative shrink-0">
                <div
                    class="flex size-12 rotate-[-6deg] items-center justify-center rounded-xl bg-brand-blue text-brand-sand shadow-sm"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-6 bg-current"
                        :style="iconMaskStyle(bellIcon)"
                    ></span>
                </div>
                <span
                    aria-hidden="true"
                    class="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-brand-yellow shadow-sm ring-2 ring-surface"
                ></span>
            </div>
            <div class="flex-1" :class="dismissible ? 'pr-6' : ''">
                <h3 class="font-semibold text-ink">
                    {{ t('Enable push notifications') }}
                </h3>
                <p class="mt-1 text-sm leading-relaxed text-ink-muted">
                    {{
                        t(
                            'Turn on push notifications to receive alerts about activity in your circles.',
                        )
                    }}
                </p>
                <button
                    type="button"
                    class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-action px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="enrolling"
                    @click="enablePushNotifications"
                >
                    <Spinner v-if="enrolling" class="size-3.5" />
                    {{ t('Turn on') }}
                </button>
            </div>
        </div>
    </div>
</template>
