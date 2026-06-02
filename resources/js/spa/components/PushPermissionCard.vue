<script setup lang="ts">
import { PushNotifications } from '@nativephp/mobile';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
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
        // Wanneer true verschijnt een sluitknop en wordt de keuze in localStorage
        // bewaard, zodat de card op die plek niet meer terugkomt. Ergens als de
        // pagina zelf het primaire onderwerp is (bv. Settings) hou je dit op false.
        dismissible?: boolean;
    }>(),
    { dismissible: false },
);

// Vuurt nadat de gebruiker de native permission-prompt heeft beantwoord
// (granted óf denied) zodat een parent kan reageren — bv. een feed verversen.
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
        // localStorage kan in private-mode of bij quota-issues falen — alleen
        // de in-memory state blijft dan over, voor deze sessie is dat genoeg.
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

async function enablePushNotifications(): Promise<void> {
    if (enrolling.value) {
        return;
    }

    enrolling.value = true;

    try {
        await PushNotifications.enroll();
        // getToken() levert de token-string zelf op (of null) — geen { token }.
        const token = await PushNotifications.getToken();

        if (token) {
            try {
                await externalApi.post('/device-token', { token });
            } catch {
                // Niet kritiek; usePushNotifications probeert opnieuw bij volgende launch.
            }
        }
    } catch {
        // Gebruiker heeft geweigerd of bridge niet beschikbaar.
    } finally {
        await refreshStatus();
        enrolling.value = false;
        emit('permission-changed', permissionStatus.value);
    }
}

// Status hercontroleren wanneer de gebruiker terugkomt uit de native
// instellingen, zodat de banner zich aanpast zonder app-restart.
function onVisibilityChange(): void {
    if (typeof document !== 'undefined' && !document.hidden) {
        void refreshStatus();
    }
}

onMounted(() => {
    void refreshStatus();

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
    }
});

onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }
});

defineExpose({ refresh: refreshStatus });
</script>

<template>
    <div
        v-if="hasBanner"
        class="reveal-item relative rounded-lg border border-brand-blue/15 bg-brand-blue/5 p-5 shadow-sm backdrop-blur-sm"
    >
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

        <div v-if="showDeniedBanner" class="flex items-start gap-3">
            <div
                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/15 text-brand-blue dark:text-ink-muted"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6 bg-current"
                    :style="iconMaskStyle(infoIcon)"
                ></span>
            </div>
            <div class="flex-1" :class="dismissible ? 'pr-6' : ''">
                <h3 class="font-semibold text-brand-blue dark:text-white">
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

        <div v-else-if="showEnablePrompt" class="flex items-start gap-3">
            <div
                class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/15 text-brand-blue dark:text-ink-muted"
            >
                <span
                    aria-hidden="true"
                    class="inline-block size-6 bg-current"
                    :style="iconMaskStyle(bellIcon)"
                ></span>
            </div>
            <div class="flex-1" :class="dismissible ? 'pr-6' : ''">
                <h3 class="font-semibold text-brand-blue dark:text-white">
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
                    class="mt-3 inline-flex items-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-action-hover disabled:opacity-60"
                    :disabled="enrolling"
                    @click="enablePushNotifications"
                >
                    {{ enrolling ? t('Enabling…') : t('Turn on') }}
                </button>
            </div>
        </div>
    </div>
</template>
