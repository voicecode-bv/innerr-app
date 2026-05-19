<script setup lang="ts">
import { Dialog, Share } from '@nativephp/mobile';
import { computed, onMounted, ref } from 'vue';
import Button from '@/components/Button.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { ApiError } from '@/spa/http/apiClient';
import {
    createInviteLink,
    listInviteLinks,
} from '@/spa/services/inviteLinks';
import type { InviteLink } from '@/spa/services/inviteLinks';

const props = defineProps<{
    circleId: string;
    circleName: string;
}>();

const { t } = useTranslations();

const links = ref<InviteLink[]>([]);
const loading = ref(true);
const creating = ref(false);
const loadError = ref<string | null>(null);
const copiedAt = ref<number | null>(null);

const activeLink = computed(() => links.value[0] ?? null);
const justCopied = computed(
    () => copiedAt.value !== null && Date.now() - copiedAt.value < 2000,
);

async function load(): Promise<void> {
    loading.value = true;
    loadError.value = null;

    try {
        links.value = await listInviteLinks(props.circleId);
    } catch {
        loadError.value = t('Could not load invite links.');
    } finally {
        loading.value = false;
    }
}

async function generate(): Promise<void> {
    if (creating.value) {
        return;
    }

    creating.value = true;

    try {
        const link = await createInviteLink(props.circleId);
        links.value = [link, ...links.value];
    } catch (error) {
        const message =
            error instanceof ApiError && error.message
                ? error.message
                : t('Could not create invite link.');
        void Dialog.alert(t('Something went wrong'), message);
    } finally {
        creating.value = false;
    }
}

async function copy(link: InviteLink): Promise<void> {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(link.url);
            copiedAt.value = Date.now();

            return;
        }
    } catch {
        // fall through
    }

    void Dialog.alert(t('Copy this link'), link.url);
}

async function share(link: InviteLink): Promise<void> {
    const text = t('Join :name on Innerr', { name: props.circleName });

    try {
        await Share.url('', text, link.url);
    } catch {
        await copy(link);
    }
}

onMounted(() => {
    void load();
});
</script>

<template>
    <div>
        <div v-if="loading" class="flex items-center justify-center py-6">
            <LoadingSpinner />
        </div>

        <p v-else-if="loadError" class="text-destructive-ink">
            {{ loadError }}
        </p>

        <div v-else-if="activeLink" class="grid grid-cols-2 gap-2">
            <Button size="md" block @click="share(activeLink)">
                {{ t('Share link') }}
            </Button>
            <Button
                size="md"
                variant="secondary"
                block
                @click="copy(activeLink)"
            >
                {{ justCopied ? t('Copied') : t('Copy') }}
            </Button>
        </div>

        <div v-else>
            <Button size="md" :disabled="creating" @click="generate">
                {{ creating ? t('Creating...') : t('Create shareable link') }}
            </Button>
        </div>
    </div>
</template>
