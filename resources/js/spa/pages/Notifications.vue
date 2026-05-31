<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import IconTile from '@/components/IconTile.vue';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator.vue';
import SurfaceCard from '@/components/SurfaceCard.vue';
import { usePullToRefresh } from '@/spa/composables/usePullToRefresh';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import AppLayout from '@/spa/layouts/AppLayout.vue';
import { useLocalThumbnailsStore } from '@/spa/stores/localThumbnails';
import { useNotificationsStore } from '@/spa/stores/notifications';
import bellIcon from '../../../svg/doodle-icons/bell.svg';
import crownIcon from '../../../svg/doodle-icons/crown.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import mailGiftIcon from '../../../svg/doodle-icons/mail-gift.svg';
import mailOpenIcon from '../../../svg/doodle-icons/mail-open.svg';
import message2Icon from '../../../svg/doodle-icons/message-2.svg';
import messageIcon from '../../../svg/doodle-icons/message.svg';
import tagIcon from '../../../svg/doodle-icons/tag.svg';
import userAddIcon from '../../../svg/doodle-icons/user-add.svg';
import userIcon from '../../../svg/doodle-icons/user.svg';

type IconToneName = 'sage' | 'sand' | 'accent' | 'teal';

interface Notification {
    id: string;
    type: string;
    data: {
        user_id?: number;
        user_name?: string;
        user_username?: string;
        user_avatar?: string | null;
        post_id?: number;
        post_media_url?: string | null;
        post_thumbnail_small_url?: string | null;
        comment_id?: number;
        comment_body?: string;
        circle_id?: number;
        circle_name?: string;
        to_user_name?: string;
        from_user_name?: string;
        recipient_name?: string;
        decliner_name?: string;
        [key: string]: unknown;
    };
    read_at: string | null;
    created_at: string;
}

interface CircleInvitation {
    id: number;
    status: string;
    created_at: string;
    circle: { id: number; name: string };
    inviter: {
        id: number;
        name: string;
        username: string;
        avatar: string | null;
    };
}

interface OwnershipTransfer {
    id: number;
    created_at: string;
    circle: { id: number; name: string };
    from_user: {
        id: number;
        name: string;
        username: string;
        avatar: string | null;
    };
    to_user: {
        id: number;
        name: string;
        username: string;
        avatar: string | null;
    };
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const { t } = useTranslations();
const router = useRouter();
const notificationsStore = useNotificationsStore();
const localThumbnails = useLocalThumbnailsStore();

// Voor video-posts bevat `post_media_url` de .m3u8-stream die niet als
// <img>-src laadt. De backend stuurt daarom `post_thumbnail_small_url` mee
// met de 300x300 poster zodra transcoding klaar is; daar gaat onze voorkeur
// naartoe. Valt die weg (oude notificaties of post nog in transcoding) dan
// pakken we de lokaal gegenereerde JPEG-thumbnail uit de plugin-store, en
// pas als laatste de `post_media_url` voor image-posts.
function thumbnailFor(notification: Notification): string | null {
    const thumbnail = notification.data.post_thumbnail_small_url;

    if (typeof thumbnail === 'string' && thumbnail.length > 0) {
        return thumbnail;
    }

    const postId = notification.data.post_id;
    const localThumbnail =
        postId !== undefined && postId !== null
            ? localThumbnails.get(String(postId))
            : null;

    if (localThumbnail) {
        return localThumbnail;
    }

    const mediaUrl = notification.data.post_media_url;
    const looksLikeImage =
        typeof mediaUrl === 'string' &&
        !/\.m3u8(\?|$)/i.test(mediaUrl) &&
        !/\.(mp4|mov|m4v|webm|avi)(\?|$)/i.test(mediaUrl);

    return looksLikeImage ? mediaUrl : null;
}

const items = ref<Notification[]>([]);
const circleInvitations = ref<CircleInvitation[]>([]);
const ownershipTransfers = ref<OwnershipTransfer[]>([]);
const currentPage = ref(1);
const lastPage = ref(1);
const isLoading = ref(true);
const isLoadingMore = ref(false);
const loadMoreError = ref<string | null>(null);
const optimisticallyRead = ref<Set<string>>(new Set());

const hiddenNotificationTypes = new Set<string>([
    'circle-ownership-transfer-requested',
    'circle-invitation-received',
]);

function isRead(notification: Notification): boolean {
    return (
        !!notification.read_at || optimisticallyRead.value.has(notification.id)
    );
}

const visibleNotifications = computed(() =>
    items.value.filter((n) => !hiddenNotificationTypes.has(n.type)),
);

const hasUnread = computed(() =>
    visibleNotifications.value.some((n) => !isRead(n)),
);
const hasMore = computed(() => currentPage.value < lastPage.value);

const layoutRef = useTemplateRef<InstanceType<typeof AppLayout>>('layout');
const containerRef = computed(() => layoutRef.value?.mainRef ?? null);

async function loadInitial(): Promise<void> {
    isLoading.value = true;

    try {
        const [notifs, invitations, transfers] = await Promise.all([
            externalApi.get<{ data: Notification[]; meta: Meta }>(
                '/notifications',
            ),
            externalApi.get<{ data: CircleInvitation[] }>(
                '/circle-invitations',
            ),
            externalApi.get<{ data: OwnershipTransfer[] }>(
                '/circle-ownership-transfers',
            ),
        ]);
        items.value = notifs.data;
        currentPage.value = notifs.meta.current_page;
        lastPage.value = notifs.meta.last_page;
        circleInvitations.value = invitations.data;
        ownershipTransfers.value = transfers.data;

        // Opening the notifications page acknowledges everything. Mark all read
        // (which resets the in-app bell and the native app icon badge) whenever
        // anything is unread, including hidden-type notifications or a count set
        // by a push. If nothing is unread locally the OS may still show an icon
        // badge from a push payload, so clear it explicitly.
        if (
            notificationsStore.unreadCount > 0 ||
            items.value.some((notification) => !notification.read_at)
        ) {
            markAllAsRead();
        } else {
            notificationsStore.syncIconBadge();
        }
    } catch {
        // ignore
    } finally {
        isLoading.value = false;
    }
}

const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: loadInitial,
    containerRef,
});

onMounted(loadInitial);

async function loadMore(): Promise<void> {
    if (isLoadingMore.value || !hasMore.value) {
        return;
    }

    isLoadingMore.value = true;
    loadMoreError.value = null;

    try {
        const result = await externalApi.get<{
            data: Notification[];
            meta: Meta;
        }>(`/notifications?page=${currentPage.value + 1}`);
        const seen = new Set(items.value.map((n) => n.id));
        const incoming = result.data.filter((n) => !seen.has(n.id));
        items.value = [...items.value, ...incoming];
        currentPage.value = result.meta.current_page;
        lastPage.value = result.meta.last_page;
    } catch {
        loadMoreError.value = t('Failed to load notifications');
    } finally {
        isLoadingMore.value = false;
    }
}

async function markAllAsRead(): Promise<void> {
    const unreadIds = items.value.filter((n) => !n.read_at).map((n) => n.id);
    unreadIds.forEach((id) => optimisticallyRead.value.add(id));
    notificationsStore.markAllRead();

    try {
        await externalApi.post('/notifications/read', {});
    } catch {
        unreadIds.forEach((id) => optimisticallyRead.value.delete(id));
        notificationsStore.invalidate();
        void notificationsStore.refresh();
    }
}

function goBack(): void {
    if (window.history.length > 1) {
        router.back();
    } else {
        router.push({ name: 'spa.home' });
    }
}

async function openNotification(notification: Notification): Promise<void> {
    if (!isRead(notification)) {
        optimisticallyRead.value.add(notification.id);
        notificationsStore.decrement();

        externalApi
            .post('/notifications/read', { ids: [notification.id] })
            .catch(() => {
                optimisticallyRead.value.delete(notification.id);
                notificationsStore.invalidate();
                void notificationsStore.refresh();
            });
    }

    if (notification.data.post_id) {
        router.push({
            name: 'spa.posts.show',
            params: { post: notification.data.post_id },
        });
    } else if (notification.data.circle_id) {
        router.push({
            name: 'spa.circles.show',
            params: { circle: notification.data.circle_id },
        });
    }
}

const processingInvitations = ref<Set<number>>(new Set());
const processingTransfers = ref<Set<number>>(new Set());

function isInvitationBusy(id: number): boolean {
    return processingInvitations.value.has(id);
}

function isTransferBusy(id: number): boolean {
    return processingTransfers.value.has(id);
}

async function acceptInvitation(invitationId: number): Promise<void> {
    if (processingInvitations.value.has(invitationId)) {
        return;
    }

    processingInvitations.value.add(invitationId);

    try {
        await externalApi.post(`/circle-invitations/${invitationId}/accept`);
        circleInvitations.value = circleInvitations.value.filter(
            (i) => i.id !== invitationId,
        );
    } catch {
        // ignore — gebruiker kan opnieuw proberen
    } finally {
        processingInvitations.value.delete(invitationId);
    }
}

async function declineInvitation(invitationId: number): Promise<void> {
    if (processingInvitations.value.has(invitationId)) {
        return;
    }

    processingInvitations.value.add(invitationId);

    try {
        await externalApi.post(`/circle-invitations/${invitationId}/decline`);
        circleInvitations.value = circleInvitations.value.filter(
            (i) => i.id !== invitationId,
        );
    } catch {
        // ignore — gebruiker kan opnieuw proberen
    } finally {
        processingInvitations.value.delete(invitationId);
    }
}

async function acceptTransfer(transferId: number): Promise<void> {
    if (processingTransfers.value.has(transferId)) {
        return;
    }

    processingTransfers.value.add(transferId);

    try {
        await externalApi.post(
            `/circle-ownership-transfers/${transferId}/accept`,
        );
        ownershipTransfers.value = ownershipTransfers.value.filter(
            (tr) => tr.id !== transferId,
        );
    } catch {
        // ignore — gebruiker kan opnieuw proberen
    } finally {
        processingTransfers.value.delete(transferId);
    }
}

async function declineTransfer(transferId: number): Promise<void> {
    if (processingTransfers.value.has(transferId)) {
        return;
    }

    processingTransfers.value.add(transferId);

    try {
        await externalApi.post(
            `/circle-ownership-transfers/${transferId}/decline`,
        );
        ownershipTransfers.value = ownershipTransfers.value.filter(
            (tr) => tr.id !== transferId,
        );
    } catch {
        // ignore — gebruiker kan opnieuw proberen
    } finally {
        processingTransfers.value.delete(transferId);
    }
}

function notificationMessage(notification: Notification): string {
    const name =
        notification.data.user_name ??
        notification.data.to_user_name ??
        notification.data.from_user_name ??
        notification.data.recipient_name ??
        notification.data.decliner_name ??
        '';

    switch (notification.type) {
        case 'post-liked':
            return t(':name liked your post', { name });
        case 'post-commented':
            return t(':name commented: :comment', {
                name,
                comment: notification.data.comment_body ?? '',
            });
        case 'comment-liked':
            return t(':name liked your comment', { name });
        case 'comment-replied':
            return t(':name replied: :comment', {
                name,
                comment: notification.data.comment_body ?? '',
            });
        case 'new-circle-post':
            return t(':name shared a new moment', { name });
        case 'post-tagged':
            return t(':name tagged you in a post', { name });
        case 'circle-invitation-accepted': {
            const circle =
                (notification.data.circle_name as string | undefined) ?? '';

            if (name && circle) {
                return t(':name accepted your invitation to :circle', {
                    name,
                    circle,
                });
            }

            if (name) {
                return t(':name accepted your invitation', { name });
            }

            if (circle) {
                return t('Your invitation to :circle was accepted', { circle });
            }

            return t('Your invitation was accepted');
        }
        case 'circle-ownership-transfer-requested':
            return t(':name wants to transfer ownership of :circle to you', {
                name,
                circle: notification.data.circle_name ?? '',
            });
        case 'circle-ownership-transfer-accepted':
            return t(':name accepted ownership of :circle', {
                name,
                circle: notification.data.circle_name ?? '',
            });
        case 'circle-ownership-transfer-declined':
            return t(':name declined ownership of :circle', {
                name,
                circle: notification.data.circle_name ?? '',
            });
        default:
            return '';
    }
}

interface BadgeConfig {
    icon: string;
    tone: IconToneName;
    bare?: boolean;
}

const typeIconMap: Record<string, BadgeConfig> = {
    'post-liked': { icon: heartFilledIcon, tone: 'accent' },
    'comment-liked': { icon: heartFilledIcon, tone: 'accent' },
    'post-commented': { icon: messageIcon, tone: 'sage' },
    'comment-replied': { icon: message2Icon, tone: 'sage' },
    'new-circle-post': { icon: bellIcon, tone: 'teal' },
    'post-tagged': { icon: tagIcon, tone: 'accent' },
    'circle-invitation-accepted': { icon: userAddIcon, tone: 'sage' },
    'circle-ownership-transfer-requested': { icon: crownIcon, tone: 'accent' },
    'circle-ownership-transfer-accepted': { icon: crownIcon, tone: 'sage' },
    'circle-ownership-transfer-declined': { icon: crownIcon, tone: 'sand' },
};

const filledToneClass: Record<IconToneName, string> = {
    sage: 'bg-sage-200 text-ink dark:bg-sage-800 dark:text-sage-100',
    sand: 'bg-sand-200 text-ink dark:bg-sand-700 dark:text-sand-200',
    accent: 'bg-accent text-white dark:bg-accent dark:text-white',
    teal: 'bg-action text-white',
};

function iconForType(type: string): BadgeConfig {
    return typeIconMap[type] ?? { icon: bellIcon, tone: 'sand' };
}

function maskStyleFor(icon: string) {
    return {
        maskImage: `url(${icon})`,
        WebkitMaskImage: `url(${icon})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
    };
}

function timeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMinutes < 1) {
        return t('just now');
    }

    if (diffMinutes < 60) {
        return t(':count min ago', { count: diffMinutes });
    }

    if (diffHours < 24) {
        return t(':count hours ago', { count: diffHours });
    }

    if (diffDays < 7) {
        return t(':count days ago', { count: diffDays });
    }

    return t(':count weeks ago', { count: diffWeeks });
}

interface NotificationGroup {
    key: 'today' | 'week' | 'earlier';
    label: string;
    items: Notification[];
}

const groupedNotifications = computed<NotificationGroup[]>(() => {
    if (!items.value.length) {
        return [];
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const groups: Record<NotificationGroup['key'], NotificationGroup> = {
        today: { key: 'today', label: t('Today'), items: [] },
        week: { key: 'week', label: t('This week'), items: [] },
        earlier: { key: 'earlier', label: t('Earlier'), items: [] },
    };

    for (const notification of items.value) {
        if (hiddenNotificationTypes.has(notification.type)) {
            continue;
        }

        const age = now - new Date(notification.created_at).getTime();

        if (age < dayMs) {
            groups.today.items.push(notification);
        } else if (age < 7 * dayMs) {
            groups.week.items.push(notification);
        } else {
            groups.earlier.items.push(notification);
        }
    }

    return Object.values(groups).filter((group) => group.items.length > 0);
});

// Sentinel-tokens zodat `t()`'s placeholder-substitutie niet de zinnen
// kapot maakt voordat we ze splitsen — namen kunnen zelf placeholder-syntax
// bevatten, dus we vervangen `:inviter` / `:circle` met onwaarschijnlijke
// markers en splitsen de string vervolgens om gestylede spans te renderen.
const INVITER_TOKEN = ' inv-inviter ';
const CIRCLE_TOKEN = ' inv-circle ';

interface InvitationSegment {
    text: string;
    type: 'plain' | 'inviter' | 'circle';
}

function invitationSegments(invitation: CircleInvitation): InvitationSegment[] {
    const tpl = t(':inviter invited you to :circle', {
        inviter: INVITER_TOKEN,
        circle: CIRCLE_TOKEN,
    });
    const segments: InvitationSegment[] = [];
    const regex = new RegExp(`(${INVITER_TOKEN}|${CIRCLE_TOKEN})`, 'g');
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(tpl)) !== null) {
        if (match.index > lastIndex) {
            segments.push({
                text: tpl.slice(lastIndex, match.index),
                type: 'plain',
            });
        }

        if (match[0] === INVITER_TOKEN) {
            segments.push({ text: invitation.inviter.name, type: 'inviter' });
        } else {
            segments.push({ text: invitation.circle.name, type: 'circle' });
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < tpl.length) {
        segments.push({ text: tpl.slice(lastIndex), type: 'plain' });
    }

    return segments;
}
</script>

<template>
    <AppLayout ref="layout" :title="t('Notifications')">
        <template #header-left>
            <button
                class="flex items-center text-ink dark:text-sand-300"
                @click="goBack"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>
        </template>

        <div
            class="relative mt-10 min-h-full pb-[calc(theme(spacing.32)+env(safe-area-inset-bottom))]"
        >
            <PullToRefreshIndicator
                :pull-distance="pullDistance"
                :is-refreshing="isRefreshing"
            />

            <div class="relative space-y-4 px-4 pt-4">
                <div v-if="hasUnread" class="reveal-item flex justify-end px-1">
                    <button
                        class="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1.5 text-ink shadow-sm backdrop-blur-sm transition hover:bg-surface dark:bg-sand-800/60 dark:text-sage-100 dark:hover:bg-sand-800"
                        @click="markAllAsRead"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-3.5 bg-current"
                            :style="maskStyleFor(mailOpenIcon)"
                        ></span>
                        {{ t('Mark all read') }}
                    </button>
                </div>

                <SurfaceCard
                    v-if="ownershipTransfers.length > 0"
                    :padded="false"
                    class="reveal-item"
                >
                    <div class="flex items-center gap-3 px-5 pt-5">
                        <IconTile :icon="crownIcon" size="sm" tone="accent" />
                        <div class="min-w-0">
                            <h3
                                class="font-semibold text-ink dark:text-sand-100"
                            >
                                {{ t('Ownership transfers') }}
                            </h3>
                            <p class="text-ink-muted dark:text-sand-400">
                                {{
                                    t(':count pending', {
                                        count: ownershipTransfers.length,
                                    })
                                }}
                            </p>
                        </div>
                    </div>
                    <ul
                        class="mt-4 divide-y divide-sand-100/80 dark:divide-sand-700/50"
                    >
                        <li
                            v-for="transfer in ownershipTransfers"
                            :key="`transfer-${transfer.id}`"
                            class="flex items-start gap-3 px-5 py-4"
                        >
                            <div class="shrink-0">
                                <img
                                    v-if="transfer.from_user.avatar"
                                    :src="transfer.from_user.avatar"
                                    :alt="transfer.from_user.name"
                                    class="size-11 rounded-full bg-sand-200 object-cover shadow-sm ring-2 ring-white dark:bg-sand-700 dark:ring-sand-800"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <div
                                    v-else
                                    class="flex size-11 items-center justify-center rounded-full bg-sand-100 ring-2 ring-white dark:bg-sand-700 dark:ring-sand-800"
                                >
                                    <IconTile
                                        :icon="userIcon"
                                        size="sm"
                                        tone="sand"
                                    />
                                </div>
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-ink dark:text-sand-100">
                                    {{
                                        t(
                                            ':name wants to transfer ownership of :circle to you',
                                            {
                                                name: transfer.from_user.name,
                                                circle: transfer.circle.name,
                                            },
                                        )
                                    }}
                                </p>
                                <p
                                    class="mt-0.5 text-ink-muted dark:text-sand-400"
                                >
                                    {{ timeAgo(transfer.created_at) }}
                                </p>
                                <div class="mt-3 flex gap-2">
                                    <button
                                        class="rounded-full bg-action px-4 py-1.5 font-semibold text-white shadow-sm transition hover:bg-action/90 disabled:opacity-50"
                                        :disabled="isTransferBusy(transfer.id)"
                                        @click="acceptTransfer(transfer.id)"
                                    >
                                        {{ t('Accept') }}
                                    </button>
                                    <button
                                        class="rounded-full bg-sand-100 px-4 py-1.5 font-semibold text-ink transition hover:bg-sand-200 disabled:opacity-50 dark:bg-sand-700/60 dark:text-sand-200 dark:hover:bg-sand-700"
                                        :disabled="isTransferBusy(transfer.id)"
                                        @click="declineTransfer(transfer.id)"
                                    >
                                        {{ t('Decline') }}
                                    </button>
                                </div>
                            </div>
                        </li>
                    </ul>
                </SurfaceCard>

                <SurfaceCard
                    v-if="circleInvitations.length > 0"
                    :padded="false"
                    class="reveal-item"
                >
                    <div class="flex items-center gap-3 px-5 pt-5">
                        <IconTile
                            :icon="mailGiftIcon"
                            size="sm"
                            tone="accent"
                        />
                        <div class="min-w-0">
                            <h3
                                class="font-semibold text-ink dark:text-sand-100"
                            >
                                {{ t('Circle invitations') }}
                            </h3>
                            <p class="text-ink-muted dark:text-sand-400">
                                {{
                                    t(':count pending', {
                                        count: circleInvitations.length,
                                    })
                                }}
                            </p>
                        </div>
                    </div>
                    <ul
                        class="mt-4 divide-y divide-sand-100/80 dark:divide-sand-700/50"
                    >
                        <li
                            v-for="invitation in circleInvitations"
                            :key="`invitation-${invitation.id}`"
                            class="flex items-start gap-3 px-5 py-4"
                        >
                            <div class="shrink-0">
                                <img
                                    v-if="invitation.inviter.avatar"
                                    :src="invitation.inviter.avatar"
                                    :alt="invitation.inviter.name"
                                    class="size-11 rounded-full bg-sand-200 object-cover shadow-sm ring-2 ring-white dark:bg-sand-700 dark:ring-sand-800"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <div
                                    v-else
                                    class="flex size-11 items-center justify-center rounded-full bg-sand-100 ring-2 ring-white dark:bg-sand-700 dark:ring-sand-800"
                                >
                                    <IconTile
                                        :icon="userIcon"
                                        size="sm"
                                        tone="sand"
                                    />
                                </div>
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-ink dark:text-sand-100">
                                    <template
                                        v-for="(
                                            segment, idx
                                        ) in invitationSegments(invitation)"
                                        :key="idx"
                                    >
                                        <span
                                            v-if="segment.type === 'inviter'"
                                            class="font-semibold"
                                            >{{ segment.text }}</span
                                        >
                                        <span
                                            v-else-if="
                                                segment.type === 'circle'
                                            "
                                            class="font-semibold text-ink dark:text-sage-100"
                                            >{{ segment.text }}</span
                                        >
                                        <span
                                            v-else
                                            class="text-ink-muted dark:text-sand-400"
                                            >{{ segment.text }}</span
                                        >
                                    </template>
                                </p>
                                <p
                                    class="mt-0.5 text-ink-muted dark:text-sand-400"
                                >
                                    {{ timeAgo(invitation.created_at) }}
                                </p>
                                <div class="mt-3 flex gap-2">
                                    <button
                                        class="rounded-full bg-action px-4 py-1.5 font-semibold text-white shadow-sm transition hover:bg-action/90 disabled:opacity-50"
                                        :disabled="
                                            isInvitationBusy(invitation.id)
                                        "
                                        @click="acceptInvitation(invitation.id)"
                                    >
                                        {{ t('Accept') }}
                                    </button>
                                    <button
                                        class="rounded-full bg-sand-100 px-4 py-1.5 font-semibold text-ink transition hover:bg-sand-200 disabled:opacity-50 dark:bg-sand-700/60 dark:text-sand-200 dark:hover:bg-sand-700"
                                        :disabled="
                                            isInvitationBusy(invitation.id)
                                        "
                                        @click="
                                            declineInvitation(invitation.id)
                                        "
                                    >
                                        {{ t('Decline') }}
                                    </button>
                                </div>
                            </div>
                        </li>
                    </ul>
                </SurfaceCard>

                <SurfaceCard
                    v-if="isLoading"
                    :padded="false"
                    class="reveal-item"
                >
                    <div
                        class="divide-y divide-sand-100/80 dark:divide-sand-700/50"
                    >
                        <div
                            v-for="n in 5"
                            :key="n"
                            class="flex items-start gap-3 px-5 py-4"
                        >
                            <div
                                class="size-11 shrink-0 animate-pulse rounded-full bg-sand-200 dark:bg-sand-700"
                            />
                            <div class="min-w-0 flex-1 space-y-2">
                                <div
                                    class="h-3.5 animate-pulse rounded-full bg-sand-200 dark:bg-sand-700"
                                    :style="{ width: `${55 + n * 6}%` }"
                                />
                                <div
                                    class="h-3 w-20 animate-pulse rounded-full bg-sand-200/70 dark:bg-sand-700/70"
                                />
                            </div>
                        </div>
                    </div>
                </SurfaceCard>

                <template v-else-if="groupedNotifications.length > 0">
                    <div
                        v-for="group in groupedNotifications"
                        :key="group.key"
                        class="reveal-item space-y-2"
                    >
                        <h2 class="px-2 font-semibold text-ink">
                            {{ group.label }}
                        </h2>
                        <SurfaceCard :padded="false">
                            <ul
                                class="divide-y divide-sand-100/80 dark:divide-sand-700/50"
                            >
                                <li
                                    v-for="notification in group.items"
                                    :key="notification.id"
                                >
                                    <button
                                        class="flex w-full items-start gap-3 px-5 py-4 text-left transition"
                                        :class="{
                                            'bg-sage-50/60 dark:bg-sage-900/20':
                                                !isRead(notification),
                                        }"
                                        @click="openNotification(notification)"
                                    >
                                        <div class="relative shrink-0">
                                            <img
                                                v-if="
                                                    notification.data
                                                        .user_avatar
                                                "
                                                :src="
                                                    notification.data
                                                        .user_avatar
                                                "
                                                :alt="
                                                    notification.data.user_name
                                                "
                                                class="size-11 rounded-full bg-sand-200 object-cover shadow-sm ring-2 ring-white dark:bg-sand-700 dark:ring-sand-800"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            <div
                                                v-else
                                                class="flex size-11 items-center justify-center overflow-hidden rounded-full bg-sand-100 ring-2 ring-white dark:bg-sand-700 dark:ring-sand-800"
                                            >
                                                <IconTile
                                                    :icon="userIcon"
                                                    size="sm"
                                                    tone="sand"
                                                />
                                            </div>
                                            <span
                                                class="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-md shadow-sm ring-1 ring-white dark:ring-sand-800"
                                                :class="
                                                    filledToneClass[
                                                        iconForType(
                                                            notification.type,
                                                        ).tone
                                                    ]
                                                "
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    class="inline-block size-3 bg-current"
                                                    :style="
                                                        maskStyleFor(
                                                            iconForType(
                                                                notification.type,
                                                            ).icon,
                                                        )
                                                    "
                                                ></span>
                                            </span>
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="line-clamp-1 leading-snug text-ink"
                                                :class="{
                                                    'font-semibold':
                                                        !isRead(notification),
                                                }"
                                            >
                                                {{
                                                    notificationMessage(
                                                        notification,
                                                    )
                                                }}
                                            </p>
                                            <p class="mt-1 text-ink-muted">
                                                {{
                                                    timeAgo(
                                                        notification.created_at,
                                                    )
                                                }}
                                            </p>
                                        </div>
                                        <div
                                            class="flex shrink-0 items-start gap-2 pt-1"
                                        >
                                            <img
                                                v-if="
                                                    thumbnailFor(notification)
                                                "
                                                :src="
                                                    thumbnailFor(
                                                        notification,
                                                    ) ?? ''
                                                "
                                                class="size-12 rounded-md bg-sand-200 object-cover shadow-sm dark:bg-sand-700"
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            <span
                                                v-if="!isRead(notification)"
                                                class="mt-1 inline-block size-2 rounded-full bg-action"
                                                aria-hidden="true"
                                            />
                                        </div>
                                    </button>
                                </li>
                            </ul>
                        </SurfaceCard>
                    </div>
                </template>

                <div
                    v-if="!isLoading && hasMore"
                    class="flex flex-col items-center gap-2 px-4 py-4"
                >
                    <button
                        class="text-ink-muted disabled:opacity-50"
                        :disabled="isLoadingMore"
                        @click="loadMore"
                    >
                        {{
                            isLoadingMore
                                ? t('Loading more...')
                                : t('Load more')
                        }}
                    </button>
                    <p v-if="loadMoreError" class="text-destructive-ink">
                        {{ loadMoreError }}
                    </p>
                </div>

                <SurfaceCard
                    v-if="
                        !isLoading &&
                        groupedNotifications.length === 0 &&
                        circleInvitations.length === 0 &&
                        ownershipTransfers.length === 0
                    "
                    class="reveal-item mt-4"
                >
                    <div
                        class="flex flex-col items-center justify-center py-10 text-center"
                    >
                        <IconTile :icon="bellIcon" size="lg" tone="sage" />
                        <h3
                            class="mt-4 font-display text-lg font-semibold text-ink"
                        >
                            {{ t('No notifications yet') }}
                        </h3>
                        <p class="mt-1 max-w-xs text-sand-600">
                            {{
                                t(
                                    "When someone interacts with your posts, you'll see it here.",
                                )
                            }}
                        </p>
                    </div>
                </SurfaceCard>
            </div>
        </div>
    </AppLayout>
</template>
