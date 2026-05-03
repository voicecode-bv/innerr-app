<script setup lang="ts">
import { Dialog, Events, Off, On } from '@nativephp/mobile';
import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    ref,
    useTemplateRef,
    watch,
} from 'vue';
import { RouterLink } from 'vue-router';
import BottomSheet from '@/components/BottomSheet.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useAuthStore } from '@/spa/stores/auth';
import { useCommentsCacheStore } from '@/spa/stores/commentsCache';
import { externalApi } from '@/spa/http/externalApi';
import heartIcon from '../../../svg/doodle-icons/heart.svg';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import messageIcon from '../../../svg/doodle-icons/message.svg';

interface Comment {
    id: number;
    body: string;
    created_at: string;
    parent_id: number | null;
    user: {
        id: number;
        name: string;
        username: string;
        avatar: string | null;
    };
    is_liked: boolean;
    likes_count: number;
    replies?: Comment[];
    replies_count?: number;
}

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const props = withDefaults(
    defineProps<{
        open: boolean;
        postId: number;
        commentsCount?: number;
        initialReplyTo?: Comment | null;
    }>(),
    {
        commentsCount: 0,
        initialReplyTo: null,
    },
);

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'commentAdded', comment: Comment): void;
    (e: 'commentDeleted', comment: Comment): void;
}>();

const { t } = useTranslations();
const auth = useAuthStore();
const commentsCache = useCommentsCacheStore();
const authUserId = computed(() => auth.user?.id ?? null);

const comments = ref<Comment[]>([]);
const replyingTo = ref<Comment | null>(props.initialReplyTo);
const body = ref('');
const isLoading = ref(false);
const isLoadingMore = ref(false);
const isSubmitting = ref(false);
const loadError = ref<string | null>(null);
const hasLoaded = ref(false);
const currentPage = ref(0);
const lastPage = ref(1);

const commentInput = useTemplateRef<HTMLInputElement>('commentInput');
const sentinelRef = useTemplateRef<HTMLDivElement>('sentinel');
let observer: IntersectionObserver | null = null;
const seenIds = new Set<number>();

function seedCommentsFromCache(): boolean {
    const cached = commentsCache.getStale<Comment>(props.postId);
    if (!cached) return false;
    comments.value = cached.comments;
    currentPage.value = cached.currentPage;
    lastPage.value = cached.lastPage;
    seenIds.clear();
    for (const c of cached.comments) {
        seenIds.add(c.id);
        for (const reply of c.replies ?? []) {
            seenIds.add(reply.id);
        }
    }
    hasLoaded.value = true;
    return true;
}

async function loadPage(page: number): Promise<void> {
    const isFirst = page === 1;
    // Eerste pagina + verse cache → skip de fetch volledig.
    if (isFirst && commentsCache.get<Comment>(props.postId)) {
        seedCommentsFromCache();
        return;
    }

    // Eerste pagina + stale cache → toon eerst, vervang daarna.
    const seededFromStale =
        isFirst && !hasLoaded.value && seedCommentsFromCache();

    if (isFirst && !seededFromStale) {
        isLoading.value = true;
    } else if (!isFirst) {
        isLoadingMore.value = true;
    }
    loadError.value = null;

    try {
        const result = await externalApi.get<{ data: Comment[]; meta: Meta }>(
            `/posts/${props.postId}/comments?page=${page}`,
        );

        if (isFirst) {
            // Volledige swap voor page 1 zodat verwijderde comments verdwijnen.
            seenIds.clear();
            comments.value = result.data;
            for (const c of result.data) {
                seenIds.add(c.id);
                for (const reply of c.replies ?? []) {
                    seenIds.add(reply.id);
                }
            }
            commentsCache.set<Comment>(
                props.postId,
                result.data,
                result.meta.current_page,
                result.meta.last_page,
            );
        } else {
            const incoming = result.data.filter((c) => {
                if (seenIds.has(c.id)) return false;
                seenIds.add(c.id);
                for (const reply of c.replies ?? []) {
                    seenIds.add(reply.id);
                }
                return true;
            });
            comments.value = [...comments.value, ...incoming];
        }

        currentPage.value = result.meta.current_page;
        lastPage.value = result.meta.last_page;
        hasLoaded.value = true;
    } catch {
        if (!seededFromStale) {
            loadError.value = t('Failed to load comments');
        }
    } finally {
        isLoading.value = false;
        isLoadingMore.value = false;
    }
}

function loadMore(): void {
    if (
        isLoadingMore.value ||
        isLoading.value ||
        currentPage.value >= lastPage.value
    )
        return;
    void loadPage(currentPage.value + 1);
}

function attachObserver(target: HTMLElement): void {
    observer?.disconnect();
    observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                loadMore();
            }
        },
        { rootMargin: '200px' },
    );
    observer.observe(target);
}

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;

        if (props.initialReplyTo) {
            replyingTo.value = props.initialReplyTo;
        }

        nextTick(() => {
            commentInput.value?.focus({ preventScroll: true });
        });

        if (!hasLoaded.value) {
            void loadPage(1);
        }
    },
    { flush: 'sync', immediate: true },
);

watch(sentinelRef, (el) => {
    if (el) {
        attachObserver(el);
    } else {
        observer?.disconnect();
        observer = null;
    }
});

watch(
    () => props.postId,
    () => {
        comments.value = [];
        seenIds.clear();
        hasLoaded.value = false;
        currentPage.value = 0;
        lastPage.value = 1;
        swipedId.value = null;
        // Sheet kan al open zijn (gebruiker klikt direct op een andere post),
        // in welk geval de open-watcher hier niet opnieuw vuurt. Trigger zelf
        // de fetch zodat we niet wachten op een tweede tap.
        if (props.open) {
            void loadPage(1);
        }
    },
);

function close(): void {
    emit('update:open', false);
    replyingTo.value = null;
    body.value = '';
    swipedId.value = null;
}

function startReply(comment: Comment): void {
    replyingTo.value = comment;
    swipedId.value = null;
    commentInput.value?.focus({ preventScroll: true });
    nextTick(() => commentInput.value?.focus({ preventScroll: true }));
}

function cancelReply(): void {
    replyingTo.value = null;
}

const ACTION_WIDTH = 88;
const swipedId = ref<number | null>(null);
const touchingId = ref<number | null>(null);
const touchStartX = ref(0);
const touchOffset = ref(0);

const REPLIES_COLLAPSE_AFTER = 3;
const expandedRepliesIds = ref<Set<number>>(new Set());

function visibleReplies(comment: Comment): Comment[] {
    const replies = comment.replies ?? [];
    if (
        replies.length <= REPLIES_COLLAPSE_AFTER ||
        expandedRepliesIds.value.has(comment.id)
    ) {
        return replies;
    }
    return replies.slice(0, REPLIES_COLLAPSE_AFTER);
}

function hiddenRepliesCount(comment: Comment): number {
    const replies = comment.replies ?? [];
    if (
        replies.length <= REPLIES_COLLAPSE_AFTER ||
        expandedRepliesIds.value.has(comment.id)
    ) {
        return 0;
    }
    return replies.length - REPLIES_COLLAPSE_AFTER;
}

function remoteRepliesCount(comment: Comment): number {
    if (typeof comment.replies_count !== 'number') return 0;
    return Math.max(0, comment.replies_count - (comment.replies?.length ?? 0));
}

interface RepliesPagination {
    lastFetchedPage: number;
    hasMore: boolean;
    loading: boolean;
    serverProbed: boolean;
}

const repliesPagination = ref<Record<number, RepliesPagination>>({});

function getRepliesState(commentId: number): RepliesPagination {
    const stored = repliesPagination.value[commentId];
    if (stored) return stored;

    // Initial state: leid 'hasMore' af van de server-`replies_count` zodat we
    // niet hoeven te probeer-fetchen als er aantoonbaar niets meer is.
    const comment =
        comments.value.find((c) => c.id === commentId) ??
        comments.value
            .flatMap((c) => c.replies ?? [])
            .find((r) => r.id === commentId);
    const total = comment?.replies_count;
    const localCount = comment?.replies?.length ?? 0;
    const hasMore = total === undefined ? true : total > localCount;

    return {
        lastFetchedPage: 1,
        hasMore,
        loading: false,
        serverProbed: false,
    };
}

function setRepliesState(
    commentId: number,
    patch: Partial<RepliesPagination>,
): void {
    repliesPagination.value[commentId] = {
        ...getRepliesState(commentId),
        ...patch,
    };
}

function canLoadMoreFromServer(comment: Comment): boolean {
    const state = getRepliesState(comment.id);
    return state.hasMore && !state.loading;
}

function isLoadingMoreReplies(comment: Comment): boolean {
    return getRepliesState(comment.id).loading;
}

async function expandReplies(comment: Comment): Promise<void> {
    // Stap 1: lokale set tonen (snel, geen netwerk).
    const isLocallyExpanded = expandedRepliesIds.value.has(comment.id);
    if (!isLocallyExpanded) {
        expandedRepliesIds.value = new Set([
            ...expandedRepliesIds.value,
            comment.id,
        ]);
    }

    // Stap 2: probeer aanvullende replies van de server (page 2+) te halen.
    // Bij 404 / netwerkfout vallen we stilletjes terug op alleen de geneste set.
    const state = getRepliesState(comment.id);
    if (!state.hasMore || state.loading) return;

    setRepliesState(comment.id, { loading: true });

    try {
        const nextPage = state.lastFetchedPage + 1;
        const result = await externalApi.get<{
            data: Comment[];
            meta?: { current_page: number; last_page: number };
        }>(`/comments/${comment.id}/replies?page=${nextPage}`);

        const incoming = result.data.filter((r) => {
            if (seenIds.has(r.id)) return false;
            seenIds.add(r.id);
            return true;
        });

        if (incoming.length > 0) {
            const target = comments.value.find((c) => c.id === comment.id);
            if (target) {
                target.replies = [...(target.replies ?? []), ...incoming];
            }
        }

        const meta = result.meta;
        setRepliesState(comment.id, {
            lastFetchedPage: nextPage,
            hasMore: meta ? nextPage < meta.last_page : incoming.length > 0,
            loading: false,
            serverProbed: true,
        });
    } catch {
        // Endpoint bestaat niet of is offline — markeer hasMore=false zodat
        // de knop verdwijnt en alleen de lokaal-geneste replies blijven.
        setRepliesState(comment.id, {
            hasMore: false,
            loading: false,
            serverProbed: true,
        });
    }
}

function rowTransform(commentId: number): string {
    if (touchingId.value === commentId) {
        return `translate3d(${touchOffset.value}px, 0, 0)`;
    }
    if (swipedId.value === commentId) {
        return `translate3d(-${ACTION_WIDTH}px, 0, 0)`;
    }
    return 'translate3d(0, 0, 0)';
}

function onSwipeStart(event: TouchEvent, comment: Comment): void {
    if (comment.user.id !== authUserId.value) return;
    touchStartX.value = event.touches[0].clientX;
    touchingId.value = comment.id;
    touchOffset.value = swipedId.value === comment.id ? -ACTION_WIDTH : 0;

    if (swipedId.value !== null && swipedId.value !== comment.id) {
        swipedId.value = null;
    }
}

function onSwipeMove(event: TouchEvent): void {
    if (touchingId.value === null) return;
    const dx = event.touches[0].clientX - touchStartX.value;
    const baseOffset = swipedId.value === touchingId.value ? -ACTION_WIDTH : 0;
    touchOffset.value = Math.max(-ACTION_WIDTH, Math.min(0, baseOffset + dx));
}

function onSwipeEnd(): void {
    if (touchingId.value === null) return;
    swipedId.value =
        touchOffset.value <= -ACTION_WIDTH / 2 ? touchingId.value : null;
    touchingId.value = null;
    touchOffset.value = 0;
}

function closeSwipe(): void {
    swipedId.value = null;
}

let pendingDeleteComment: Comment | null = null;

async function requestDelete(comment: Comment): Promise<void> {
    if (comment.user.id !== authUserId.value) return;
    pendingDeleteComment = comment;
    swipedId.value = null;
    await Dialog.alert()
        .confirm(
            t('Delete comment'),
            t('Are you sure you want to delete this comment?'),
        )
        .id('delete-comment-confirm');
}

async function handleButtonPressed(payload: {
    index: number;
    id?: string | null;
}): Promise<void> {
    if (payload.id !== 'delete-comment-confirm' || payload.index !== 1) return;
    const target = pendingDeleteComment;
    pendingDeleteComment = null;
    if (target) await deleteComment(target);
}

onMounted(() => On(Events.Alert.ButtonPressed, handleButtonPressed));
onUnmounted(() => {
    Off(Events.Alert.ButtonPressed, handleButtonPressed);
    observer?.disconnect();
    observer = null;
});

async function deleteComment(comment: Comment): Promise<void> {
    let backupParent: Comment | null = null;
    let backupIndex = -1;

    const topIndex = comments.value.findIndex((c) => c.id === comment.id);
    if (topIndex !== -1) {
        backupIndex = topIndex;
        comments.value = comments.value.filter((c) => c.id !== comment.id);
    } else {
        for (const parent of comments.value) {
            if (!parent.replies) continue;
            const idx = parent.replies.findIndex((r) => r.id === comment.id);
            if (idx !== -1) {
                backupParent = parent;
                backupIndex = idx;
                parent.replies = parent.replies.filter(
                    (r) => r.id !== comment.id,
                );
                break;
            }
        }
    }

    try {
        await externalApi.delete(`/comments/${comment.id}`);
        commentsCache.invalidate(props.postId);
        emit('commentDeleted', comment);
    } catch {
        if (backupParent && backupParent.replies) {
            const next = [...backupParent.replies];
            next.splice(backupIndex, 0, comment);
            backupParent.replies = next;
        } else if (backupIndex !== -1) {
            const next = [...comments.value];
            next.splice(backupIndex, 0, comment);
            comments.value = next;
        }
    }
}

async function toggleCommentLike(comment: Comment): Promise<void> {
    if (comment.user.id === authUserId.value) return;

    const wasLiked = comment.is_liked;
    comment.is_liked = !wasLiked;
    comment.likes_count += wasLiked ? -1 : 1;

    try {
        if (wasLiked) {
            await externalApi.delete(`/comments/${comment.id}/like`);
        } else {
            await externalApi.post(`/comments/${comment.id}/like`);
        }
    } catch {
        comment.is_liked = wasLiked;
        comment.likes_count += wasLiked ? 1 : -1;
    }
}

let optimisticIdCounter = -1;

function makeOptimisticComment(
    content: string,
    parentId: number | null,
): Comment {
    return {
        id: optimisticIdCounter--,
        body: content,
        created_at: new Date().toISOString(),
        parent_id: parentId,
        user: {
            id: authUserId.value ?? 0,
            name: auth.user?.name ?? '',
            username: auth.user?.username ?? '',
            avatar: auth.user?.avatar ?? null,
        },
        is_liked: false,
        likes_count: 0,
        replies: [],
    };
}

function scrollToComment(commentId: number): void {
    nextTick(() => {
        const el = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (el instanceof HTMLElement) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

async function submitComment(): Promise<void> {
    const value = body.value.trim();
    if (!value || isSubmitting.value) return;

    const parentId = replyingTo.value?.id ?? null;
    const optimistic = makeOptimisticComment(value, parentId);

    if (parentId) {
        const parent = comments.value.find((c) => c.id === parentId);
        if (parent) {
            parent.replies = [...(parent.replies ?? []), optimistic];
            expandedRepliesIds.value = new Set([
                ...expandedRepliesIds.value,
                parent.id,
            ]);
        } else {
            comments.value = [optimistic, ...comments.value];
        }
    } else {
        comments.value = [optimistic, ...comments.value];
    }

    scrollToComment(optimistic.id);

    const submittedBody = body.value;
    const submittedReplyingTo = replyingTo.value;
    body.value = '';
    replyingTo.value = null;

    isSubmitting.value = true;
    try {
        const response = await externalApi.post<{ data: Comment }>(
            `/posts/${props.postId}/comments`,
            {
                body: value,
                parent_comment_id: parentId,
            },
        );
        const created = response.data;

        if (parentId) {
            const parent = comments.value.find((c) => c.id === parentId);
            if (parent && parent.replies) {
                parent.replies = parent.replies.map((r) =>
                    r.id === optimistic.id ? created : r,
                );
            }
        } else {
            comments.value = comments.value.map((c) =>
                c.id === optimistic.id ? created : c,
            );
        }
        seenIds.add(created.id);

        commentsCache.invalidate(props.postId);
        emit('commentAdded', created);
    } catch {
        if (parentId) {
            const parent = comments.value.find((c) => c.id === parentId);
            if (parent && parent.replies) {
                parent.replies = parent.replies.filter(
                    (r) => r.id !== optimistic.id,
                );
            }
        } else {
            comments.value = comments.value.filter(
                (c) => c.id !== optimistic.id,
            );
        }
        body.value = submittedBody;
        replyingTo.value = submittedReplyingTo;
    } finally {
        isSubmitting.value = false;
    }
}

function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return t('just now');
    if (seconds < 3600)
        return t(':count min ago', { count: Math.floor(seconds / 60) });
    if (seconds < 86400)
        return t(':count hours ago', { count: Math.floor(seconds / 3600) });
    if (seconds < 604800)
        return t(':count days ago', { count: Math.floor(seconds / 86400) });
    return t(':count weeks ago', { count: Math.floor(seconds / 604800) });
}

function onSheetUpdate(value: boolean): void {
    if (!value) {
        close();
    } else {
        emit('update:open', true);
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

defineExpose({
    reload: async (): Promise<void> => {
        commentsCache.invalidate(props.postId);
        comments.value = [];
        seenIds.clear();
        hasLoaded.value = false;
        currentPage.value = 0;
        lastPage.value = 1;
        swipedId.value = null;
        if (props.open) {
            await loadPage(1);
        }
    },
});
</script>

<template>
    <BottomSheet :open="open" @update:open="onSheetUpdate">
        <template #header>
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-sand-700 dark:text-sand-300">
                    {{ t('Comments') }}
                    <span
                        v-if="commentsCount > 0"
                        class="font-normal text-sand-400 dark:text-sand-500"
                        >({{ commentsCount }})</span
                    >
                </h2>
                <button
                    class="text-sand-500 dark:text-sand-400"
                    :aria-label="t('Close')"
                    @click="close"
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
                            d="M6 18 18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </template>

        <div
            v-if="isLoading"
            class="flex items-center justify-center px-4 py-10"
        >
            <svg
                class="size-6 animate-spin text-sand-400 dark:text-sand-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                />
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
        </div>

        <div
            v-else-if="loadError && comments.length === 0"
            class="px-4 py-10 text-center"
        >
            <p class="text-blush-500">{{ loadError }}</p>
            <button
                class="mt-2 text-sand-500 dark:text-sand-400"
                @click="loadPage(1)"
            >
                {{ t('Try again') }}
            </button>
        </div>

        <div
            v-else-if="comments.length === 0"
            class="flex flex-col items-center justify-center px-8 py-2 text-center"
        >
            <div
                aria-hidden="true"
                class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-sage-100 text-teal dark:bg-sage-900/40"
            >
                <span
                    class="inline-block size-8 bg-current"
                    :style="iconMaskStyle(messageIcon)"
                ></span>
            </div>
            <h3
                class="font-display text-lg font-semibold text-sand-800 dark:text-sand-200"
            >
                {{ t('No comments yet') }}
            </h3>
            <p class="mt-2 text-sand-600 dark:text-sand-400">
                {{ t('Share what you think!') }}
            </p>
        </div>

        <div v-else>
            <div v-for="comment in comments" :key="comment.id">
                <div
                    :data-comment-id="comment.id"
                    class="relative overflow-hidden border-b border-sand-50 bg-white dark:border-sand-800 dark:bg-sand-900"
                >
                    <button
                        v-if="comment.user.id === authUserId"
                        class="absolute inset-y-0 right-0 flex w-22 items-center justify-center bg-blush-500 font-semibold text-white"
                        :style="{ width: `${ACTION_WIDTH}px` }"
                        :aria-label="t('Delete comment')"
                        @click="requestDelete(comment)"
                    >
                        {{ t('Delete') }}
                    </button>
                    <div
                        class="relative flex gap-3 bg-white px-4 py-3 dark:bg-sand-900"
                        :class="
                            touchingId === comment.id
                                ? ''
                                : 'transition-transform duration-200 ease-out'
                        "
                        :style="{ transform: rowTransform(comment.id) }"
                        @touchstart.passive="onSwipeStart($event, comment)"
                        @touchmove.passive="onSwipeMove"
                        @touchend="onSwipeEnd"
                        @touchcancel="onSwipeEnd"
                        @click="closeSwipe"
                    >
                        <RouterLink
                            :to="{
                                name: 'spa.profiles.show',
                                params: { username: comment.user.username },
                            }"
                            class="mt-0.5 flex-shrink-0"
                            @click="close"
                        >
                            <img
                                :src="
                                    comment.user.avatar ??
                                    `https://ui-avatars.com/api/?name=${comment.user.name}&background=f0dcc6&color=5c3f24&size=64`
                                "
                                :alt="comment.user.name"
                                class="size-8 rounded-full bg-sand-200 object-cover dark:bg-sand-700"
                                loading="lazy"
                                decoding="async"
                            />
                        </RouterLink>
                        <div class="flex-1">
                            <p class="text-sand-800 dark:text-sand-200">
                                <RouterLink
                                    :to="{
                                        name: 'spa.profiles.show',
                                        params: {
                                            username: comment.user.username,
                                        },
                                    }"
                                    class="font-semibold"
                                    @click="close"
                                >
                                    {{ comment.user.name }}
                                </RouterLink>
                                {{ ' ' + comment.body }}
                            </p>
                            <div class="mt-1 flex items-center gap-3">
                                <span
                                    class="text-sand-400 dark:text-sand-500"
                                    >{{ timeAgo(comment.created_at) }}</span
                                >
                                <button
                                    class="text-sand-500 dark:text-sand-400"
                                    @click.stop="startReply(comment)"
                                >
                                    {{ t('Reply') }}
                                </button>
                            </div>
                        </div>
                        <div
                            class="mt-1 flex flex-shrink-0 flex-col items-center gap-0.5"
                        >
                            <button
                                :disabled="comment.user.id === authUserId"
                                @click.stop="toggleCommentLike(comment)"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-4"
                                    :class="
                                        comment.is_liked
                                            ? 'bg-blush-400'
                                            : 'bg-sand-400 dark:bg-sand-500'
                                    "
                                    :style="
                                        iconMaskStyle(
                                            comment.is_liked
                                                ? heartFilledIcon
                                                : heartIcon,
                                        )
                                    "
                                ></span>
                            </button>
                            <span
                                v-if="comment.likes_count > 0"
                                class="text-sand-400 dark:text-sand-500"
                                >{{ comment.likes_count }}</span
                            >
                        </div>
                    </div>
                </div>

                <div
                    v-for="reply in visibleReplies(comment)"
                    :key="reply.id"
                    :data-comment-id="reply.id"
                    class="relative overflow-hidden border-b border-sand-50 bg-white dark:border-sand-800 dark:bg-sand-900"
                >
                    <button
                        v-if="reply.user.id === authUserId"
                        class="absolute inset-y-0 right-0 flex items-center justify-center bg-blush-500 font-semibold text-white"
                        :style="{ width: `${ACTION_WIDTH}px` }"
                        :aria-label="t('Delete comment')"
                        @click="requestDelete(reply)"
                    >
                        {{ t('Delete') }}
                    </button>
                    <div
                        class="relative flex gap-3 bg-white py-3 pr-4 pl-14 dark:bg-sand-900"
                        :class="
                            touchingId === reply.id
                                ? ''
                                : 'transition-transform duration-200 ease-out'
                        "
                        :style="{ transform: rowTransform(reply.id) }"
                        @touchstart.passive="onSwipeStart($event, reply)"
                        @touchmove.passive="onSwipeMove"
                        @touchend="onSwipeEnd"
                        @touchcancel="onSwipeEnd"
                        @click="closeSwipe"
                    >
                        <RouterLink
                            :to="{
                                name: 'spa.profiles.show',
                                params: { username: reply.user.username },
                            }"
                            class="mt-0.5 flex-shrink-0"
                            @click="close"
                        >
                            <img
                                :src="
                                    reply.user.avatar ??
                                    `https://ui-avatars.com/api/?name=${reply.user.name}&background=f0dcc6&color=5c3f24&size=64`
                                "
                                :alt="reply.user.name"
                                class="size-6 rounded-full bg-sand-200 object-cover dark:bg-sand-700"
                                loading="lazy"
                                decoding="async"
                            />
                        </RouterLink>
                        <div class="flex-1">
                            <p class="text-sand-800 dark:text-sand-200">
                                <RouterLink
                                    :to="{
                                        name: 'spa.profiles.show',
                                        params: {
                                            username: reply.user.username,
                                        },
                                    }"
                                    class="font-semibold"
                                    @click="close"
                                >
                                    {{ reply.user.name }}
                                </RouterLink>
                                {{ ' ' + reply.body }}
                            </p>
                            <div class="mt-1 flex items-center gap-3">
                                <span
                                    class="text-sand-400 dark:text-sand-500"
                                    >{{ timeAgo(reply.created_at) }}</span
                                >
                                <button
                                    class="text-sand-500 dark:text-sand-400"
                                    @click.stop="startReply(comment)"
                                >
                                    {{ t('Reply') }}
                                </button>
                            </div>
                        </div>
                        <div
                            class="mt-1 flex flex-shrink-0 flex-col items-center gap-0.5"
                        >
                            <button
                                :disabled="reply.user.id === authUserId"
                                @click.stop="toggleCommentLike(reply)"
                            >
                                <span
                                    aria-hidden="true"
                                    class="inline-block size-4"
                                    :class="
                                        reply.is_liked
                                            ? 'bg-blush-400'
                                            : 'bg-sand-400 dark:bg-sand-500'
                                    "
                                    :style="
                                        iconMaskStyle(
                                            reply.is_liked
                                                ? heartFilledIcon
                                                : heartIcon,
                                        )
                                    "
                                ></span>
                            </button>
                            <span
                                v-if="reply.likes_count > 0"
                                class="text-sand-400 dark:text-sand-500"
                                >{{ reply.likes_count }}</span
                            >
                        </div>
                    </div>
                </div>

                <button
                    v-if="
                        hiddenRepliesCount(comment) > 0 ||
                        remoteRepliesCount(comment) > 0 ||
                        (expandedRepliesIds.has(comment.id) &&
                            canLoadMoreFromServer(comment))
                    "
                    class="block w-full border-b border-sand-50 bg-white py-2 pr-4 pl-14 text-left text-sand-500 hover:text-teal disabled:opacity-50 dark:border-sand-800 dark:bg-sand-900 dark:text-sand-400"
                    :disabled="isLoadingMoreReplies(comment)"
                    @click="expandReplies(comment)"
                >
                    <template v-if="isLoadingMoreReplies(comment)">{{
                        t('Loading more...')
                    }}</template>
                    <template v-else-if="hiddenRepliesCount(comment) > 0">
                        {{
                            hiddenRepliesCount(comment) +
                                remoteRepliesCount(comment) ===
                            1
                                ? t('Show :count more reply', {
                                      count:
                                          hiddenRepliesCount(comment) +
                                          remoteRepliesCount(comment),
                                  })
                                : t('Show :count more replies', {
                                      count:
                                          hiddenRepliesCount(comment) +
                                          remoteRepliesCount(comment),
                                  })
                        }}
                    </template>
                    <template v-else-if="remoteRepliesCount(comment) > 0">
                        {{
                            remoteRepliesCount(comment) === 1
                                ? t('Show :count more reply', {
                                      count: remoteRepliesCount(comment),
                                  })
                                : t('Show :count more replies', {
                                      count: remoteRepliesCount(comment),
                                  })
                        }}
                    </template>
                    <template v-else>{{ t('Load more replies') }}</template>
                </button>
            </div>

            <div
                v-if="isLoadingMore"
                class="flex items-center justify-center gap-2 px-4 py-4 text-sand-500 dark:text-sand-400"
            >
                {{ t('Loading more...') }}
            </div>

            <p v-if="loadError" class="px-4 py-2 text-center text-blush-500">
                {{ loadError }}
            </p>

            <div ref="sentinel" class="h-1" />
        </div>

        <template #footer>
            <div
                v-if="replyingTo"
                class="flex items-center justify-between border-b border-sand-100 px-4 py-2 dark:border-sand-800"
            >
                <span class="text-sand-500 dark:text-sand-400">
                    {{ t('Replying to') }}
                    <span class="font-semibold">{{
                        replyingTo.user.name
                    }}</span>
                </span>
                <button
                    class="text-sand-500 dark:text-sand-400"
                    :aria-label="t('Cancel reply')"
                    @click="cancelReply"
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
            </div>
            <div class="flex items-center gap-3 px-4 py-3">
                <img
                    :src="
                        auth.user?.avatar ??
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(auth.user?.name ?? '')}&background=f0dcc6&color=5c3f24&size=64`
                    "
                    :alt="auth.user?.name ?? ''"
                    class="size-8 flex-shrink-0 rounded-full bg-sand-200 object-cover dark:bg-sand-800"
                    loading="lazy"
                    decoding="async"
                />
                <form
                    class="flex flex-1 items-center gap-2"
                    @submit.prevent="submitComment"
                >
                    <input
                        ref="commentInput"
                        v-model="body"
                        type="text"
                        inputmode="text"
                        autocapitalize="sentences"
                        enterkeyhint="send"
                        :placeholder="
                            replyingTo
                                ? t('Write a reply...')
                                : t('Write a comment...')
                        "
                        class="flex-1 bg-transparent text-sand-800 placeholder-sand-400 focus:outline-none dark:text-sand-100 dark:placeholder-sand-500"
                        @click.stop
                    />
                    <button
                        type="submit"
                        class="font-semibold text-sand-600 disabled:opacity-30 dark:text-sand-400"
                        :disabled="!body.trim() || isSubmitting"
                    >
                        {{ t('Post') }}
                    </button>
                </form>
            </div>
        </template>
    </BottomSheet>
</template>
