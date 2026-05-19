<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInviteRedeem } from '@/spa/composables/useInviteRedeem';
import { secureStorage, TOKEN_KEY } from '@/spa/composables/useSecureStorage';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAuthStore } from '@/spa/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useTranslations();
const { redirectAfterAuth } = useInviteRedeem();

function failTo(errorCode: string): void {
    router.replace({ name: 'spa.login', query: { oauth_error: errorCode } });
}

onMounted(async () => {
    const errorParam = route.query.error;

    if (typeof errorParam === 'string' && errorParam !== '') {
        failTo(errorParam);

        return;
    }

    const tokenParam = route.query.token;

    if (typeof tokenParam !== 'string' || tokenParam === '') {
        failTo('missing_token');

        return;
    }

    await secureStorage.set(TOKEN_KEY, tokenParam);
    auth.token = tokenParam;

    try {
        const data = await auth.bootstrap();

        if (data.user) {
            const fallback = data.user.onboarded ? '/' : '/onboarding/intro';
            await redirectAfterAuth(fallback);
        } else {
            failTo('invalid_token');
        }
    } catch {
        failTo('invalid_token');
    }
});
</script>

<template>
    <div class="flex h-dvh items-center justify-center bg-sand px-6">
        <div class="flex flex-col items-center gap-3 text-sand-600">
            <span class="flex items-center gap-1" aria-hidden="true">
                <span class="dot dot-1 size-2 rounded-full bg-action"></span>
                <span class="dot dot-2 size-2 rounded-full bg-accent"></span>
                <span class="dot dot-3 size-2 rounded-full bg-sage-500"></span>
            </span>
            <p>{{ t('Signing you in...') }}</p>
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
