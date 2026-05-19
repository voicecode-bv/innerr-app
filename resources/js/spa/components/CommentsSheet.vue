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
import BottomSheet from '@/components/BottomSheet.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import SheetHeader from '@/components/SheetHeader.vue';
import CommentBubble from '@/spa/components/CommentBubble.vue';
import HiddenCommentsNotice from '@/spa/components/HiddenCommentsNotice.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { externalApi } from '@/spa/http/externalApi';
import { useAuthStore } from '@/spa/stores/auth';
import { useCommentsCacheStore } from '@/spa/stores/commentsCache';
import deleteIcon from '../../../svg/doodle-icons/delete.svg';
import sendIcon from '../../../svg/doodle-icons/send.svg';

interface Comment {
    id: string;
    is_visible?: boolean;
    body?: string;
    created_at: string;
    user?: {
        id: string;
        name: string;
        username: string;
        avatar: string | null;
    };
    is_liked?: boolean;
    likes_count?: number;
}

type RenderItem =
    | { kind: 'comment'; comment: Comment }
    | { kind: 'hidden'; count: number; key: string };

interface Meta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const props = withDefaults(
    defineProps<{
        open: boolean;
        postId: string;
        commentsCount?: number;
    }>(),
    {
        commentsCount: 0,
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
const body = ref('');
const isLoading = ref(false);
const isLoadingMore = ref(false);
const isSubmitting = ref(false);
const loadError = ref<string | null>(null);
const hasLoaded = ref(false);
const currentPage = ref(0);
const lastPage = ref(1);

const sentinelRef = useTemplateRef<HTMLDivElement>('sentinel');
let observer: IntersectionObserver | null = null;
const seenIds = new Set<string>();

// Groepeert opeenvolgende verborgen comments tot één compacte melding,
// zodat de timeline-volgorde behouden blijft (visible — N verborgen — visible …).
const renderItems = computed<RenderItem[]>(() => {
    const out: RenderItem[] = [];
    let hiddenRun: Comment[] = [];
    const flush = () => {
        if (hiddenRun.length === 0) {
return;
}

        out.push({
            kind: 'hidden',
            count: hiddenRun.length,
            key: `h-${hiddenRun[0].id}`,
        });
        hiddenRun = [];
    };

    for (const c of comments.value) {
        if (c.is_visible === false) {
            hiddenRun.push(c);
        } else {
            flush();
            out.push({ kind: 'comment', comment: c });
        }
    }

    flush();

    return out;
});

function seedCommentsFromCache(): boolean {
    const cached = commentsCache.getStale<Comment>(props.postId);

    if (!cached) {
return false;
}

    comments.value = cached.comments;
    currentPage.value = cached.currentPage;
    lastPage.value = cached.lastPage;
    seenIds.clear();

    for (const c of cached.comments) {
        seenIds.add(c.id);
    }

    hasLoaded.value = true;

    return true;
}

async function loadPage(page: number): Promise<void> {
    const isFirst = page === 1;

    if (isFirst && commentsCache.get<Comment>(props.postId)) {
        seedCommentsFromCache();
        scrollToBottom();

        return;
    }

    const seededFromStale =
        isFirst && !hasLoaded.value && seedCommentsFromCache();

    if (seededFromStale) {
        scrollToBottom();
    }

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
            seenIds.clear();
            comments.value = result.data;

            for (const c of result.data) {
                seenIds.add(c.id);
            }

            commentsCache.set<Comment>(
                props.postId,
                result.data,
                result.meta.current_page,
                result.meta.last_page,
            );
            scrollToBottom();
        } else {
            const incoming = result.data.filter((c) => {
                if (seenIds.has(c.id)) {
return false;
}

                seenIds.add(c.id);

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
    ) {
return;
}

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
        if (!isOpen) {
return;
}

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

        if (props.open) {
            void loadPage(1);
        }
    },
);

function close(): void {
    emit('update:open', false);
    body.value = '';
    swipedId.value = null;
}

const ACTION_WIDTH = 88;
const swipedId = ref<string | null>(null);
const touchingId = ref<string | null>(null);
const touchStartX = ref(0);
const touchOffset = ref(0);

function rowTransform(commentId: string): string {
    if (touchingId.value === commentId) {
        return `translate3d(${touchOffset.value}px, 0, 0)`;
    }

    if (swipedId.value === commentId) {
        return `translate3d(-${ACTION_WIDTH}px, 0, 0)`;
    }

    return 'translate3d(0, 0, 0)';
}

function onSwipeStart(event: TouchEvent, comment: Comment): void {
    if (comment.user?.id !== authUserId.value) {
return;
}

    touchStartX.value = event.touches[0].clientX;
    touchingId.value = comment.id;
    touchOffset.value = swipedId.value === comment.id ? -ACTION_WIDTH : 0;

    if (swipedId.value !== null && swipedId.value !== comment.id) {
        swipedId.value = null;
    }
}

function onSwipeMove(event: TouchEvent): void {
    if (touchingId.value === null) {
return;
}

    const dx = event.touches[0].clientX - touchStartX.value;
    const baseOffset = swipedId.value === touchingId.value ? -ACTION_WIDTH : 0;
    touchOffset.value = Math.max(-ACTION_WIDTH, Math.min(0, baseOffset + dx));
}

function onSwipeEnd(): void {
    if (touchingId.value === null) {
return;
}

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
    if (comment.user?.id !== authUserId.value) {
return;
}

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
    if (payload.id !== 'delete-comment-confirm' || payload.index !== 1) {
return;
}

    const target = pendingDeleteComment;
    pendingDeleteComment = null;

    if (target) {
await deleteComment(target);
}
}

onMounted(() => On(Events.Alert.ButtonPressed, handleButtonPressed));
onUnmounted(() => {
    Off(Events.Alert.ButtonPressed, handleButtonPressed);
    observer?.disconnect();
    observer = null;
});

async function deleteComment(comment: Comment): Promise<void> {
    const backupIndex = comments.value.findIndex((c) => c.id === comment.id);

    if (backupIndex === -1) {
return;
}

    comments.value = comments.value.filter((c) => c.id !== comment.id);

    try {
        await externalApi.delete(`/comments/${comment.id}`);
        commentsCache.invalidate(props.postId);
        emit('commentDeleted', comment);
    } catch {
        const next = [...comments.value];
        next.splice(backupIndex, 0, comment);
        comments.value = next;
    }
}

async function toggleCommentLike(comment: Comment): Promise<void> {
    if (!comment.user || comment.user.id === authUserId.value) {
return;
}

    const wasLiked = comment.is_liked ?? false;
    comment.is_liked = !wasLiked;
    comment.likes_count = (comment.likes_count ?? 0) + (wasLiked ? -1 : 1);

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

function makeOptimisticComment(content: string): Comment {
    return {
        id: `optimistic-${crypto.randomUUID()}`,
        is_visible: true,
        body: content,
        created_at: new Date().toISOString(),
        user: {
            id: authUserId.value ?? '',
            name: auth.user?.name ?? '',
            username: auth.user?.username ?? '',
            avatar: auth.user?.avatar ?? null,
        },
        is_liked: false,
        likes_count: 0,
    };
}

function scrollToComment(commentId: string): void {
    nextTick(() => {
        const el = document.querySelector(`[data-comment-id="${commentId}"]`);

        if (el instanceof HTMLElement) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

function scrollToBottom(): void {
    nextTick(() => {
        const last = comments.value[comments.value.length - 1];

        if (!last) {
return;
}

        const el = document.querySelector(`[data-comment-id="${last.id}"]`);

        if (el instanceof HTMLElement) {
            el.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
    });
}

async function submitComment(): Promise<void> {
    const value = body.value.trim();

    if (!value || isSubmitting.value) {
return;
}

    const optimistic = makeOptimisticComment(value);
    comments.value = [...comments.value, optimistic];

    scrollToComment(optimistic.id);

    const submittedBody = body.value;
    body.value = '';

    isSubmitting.value = true;

    try {
        const response = await externalApi.post<{ data: Comment }>(
            `/posts/${props.postId}/comments`,
            { body: value },
        );
        const created = response.data;

        comments.value = comments.value.map((c) =>
            c.id === optimistic.id ? created : c,
        );
        seenIds.add(created.id);

        commentsCache.invalidate(props.postId);
        emit('commentAdded', created);
    } catch {
        comments.value = comments.value.filter((c) => c.id !== optimistic.id);
        body.value = submittedBody;
    } finally {
        isSubmitting.value = false;
    }
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
            <SheetHeader :title="t('Comments')" @close="close" />
        </template>

        <div
            v-if="isLoading"
            class="flex items-center justify-center px-4 py-10"
        >
            <LoadingSpinner />
        </div>

        <div
            v-else-if="loadError && comments.length === 0"
            class="px-4 py-10 text-center"
        >
            <p class="text-destructive-ink">{{ loadError }}</p>
            <button class="mt-2 text-ink-muted" @click="loadPage(1)">
                {{ t('Try again') }}
            </button>
        </div>

        <div
            v-else-if="comments.length === 0"
            class="flex flex-col items-center justify-center px-8 py-2 text-center"
        >
            <h3 class="font-display text-lg font-semibold text-ink">
                {{ t('No comments yet') }}
            </h3>
            <p class="mt-2 text-ink-muted">
                {{ t('Share what you think!') }}
            </p>
        </div>

        <div v-else class="space-y-3 px-3 py-3">
            <template v-for="item in renderItems" :key="item.kind === 'hidden' ? item.key : item.comment.id">
                <HiddenCommentsNotice
                    v-if="item.kind === 'hidden'"
                    :count="item.count"
                />
                <div
                    v-else-if="item.comment.user"
                    :data-comment-id="item.comment.id"
                    class="relative overflow-hidden"
                >
                    <button
                        v-if="item.comment.user.id === authUserId"
                        class="absolute inset-y-0 right-0 flex items-center justify-center bg-blush-500 text-white"
                        :style="{ width: `${ACTION_WIDTH}px` }"
                        :aria-label="t('Delete comment')"
                        @click="requestDelete(item.comment)"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-6 bg-current"
                            :style="iconMaskStyle(deleteIcon)"
                        ></span>
                    </button>
                    <div
                        class="bg-sand"
                        :class="
                            touchingId === item.comment.id
                                ? ''
                                : 'transition-transform duration-200 ease-out'
                        "
                        :style="{ transform: rowTransform(item.comment.id) }"
                        @touchstart.passive="onSwipeStart($event, item.comment)"
                        @touchmove.passive="onSwipeMove"
                        @touchend="onSwipeEnd"
                        @touchcancel="onSwipeEnd"
                        @click="closeSwipe"
                    >
                        <CommentBubble
                            :comment="{
                                id: item.comment.id,
                                body: item.comment.body ?? '',
                                created_at: item.comment.created_at,
                                user: item.comment.user,
                                is_liked: item.comment.is_liked ?? false,
                                likes_count: item.comment.likes_count ?? 0,
                            }"
                            @like="toggleCommentLike(item.comment)"
                            @navigate="close"
                        />
                    </div>
                </div>
            </template>

            <div
                v-if="isLoadingMore"
                class="flex items-center justify-center gap-2 px-4 py-4 text-ink-muted"
            >
                {{ t('Loading more...') }}
            </div>

            <p v-if="loadError" class="px-4 py-2 text-center text-destructive-ink">
                {{ loadError }}
            </p>

            <div ref="sentinel" class="h-1" />
        </div>

        <template #footer>
            <form
                class="flex items-end gap-2 px-3 py-2"
                @submit.prevent="submitComment"
            >
                <input
                    v-model="body"
                    type="text"
                    inputmode="text"
                    autocapitalize="sentences"
                    enterkeyhint="send"
                    :placeholder="t('Write a comment...')"
                    class="field min-w-0 flex-1"
                    @click.stop
                />
                <button
                    type="submit"
                    class="flex size-14 shrink-0 items-center justify-center rounded-full bg-action text-white shadow-sm transition-opacity disabled:opacity-30"
                    :disabled="!body.trim() || isSubmitting"
                    :aria-label="t('Post')"
                >
                    <span
                        aria-hidden="true"
                        class="inline-block size-6 bg-current"
                        :style="iconMaskStyle(sendIcon)"
                    ></span>
                </button>
            </form>
        </template>
    </BottomSheet>
</template>
