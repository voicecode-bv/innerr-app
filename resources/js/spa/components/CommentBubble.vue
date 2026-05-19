<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/spa/stores/auth';
import heartFilledIcon from '../../../svg/doodle-icons/heart-filled.svg';
import heartIcon from '../../../svg/doodle-icons/heart.svg';

interface CommentUser {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
}

interface ChatComment {
    id: string;
    body: string;
    created_at: string;
    user: CommentUser;
    is_liked: boolean;
    likes_count: number;
}

const props = defineProps<{
    comment: ChatComment;
}>();

defineEmits<{
    (e: 'like'): void;
    (e: 'navigate'): void;
}>();

const auth = useAuthStore();

const isOwn = computed(() => props.comment.user.id === auth.user?.id);

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

function chatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const time = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    if (date.toDateString() === now.toDateString()) {
        return time;
    }

    const day = date.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
    });

    return `${day} ${time}`;
}
</script>

<template>
    <div :class="['flex gap-2', isOwn ? 'justify-end' : 'justify-start']">
        <RouterLink
            v-if="!isOwn"
            :to="{
                name: 'spa.profiles.show',
                params: { username: comment.user.username },
            }"
            class="mt-auto shrink-0"
            @click="$emit('navigate')"
        >
            <img
                :src="
                    comment.user.avatar ??
                    `https://ui-avatars.com/api/?name=${comment.user.name}&background=f0dcc6&color=5c3f24&size=64`
                "
                :alt="comment.user.name"
                class="avatar-ring size-8 rounded-full bg-sand-200 object-cover"
                loading="lazy"
                decoding="async"
            />
        </RouterLink>
        <div class="flex max-w-[78%] flex-col gap-1">
            <div
                :class="[
                    'rounded-2xl px-3 py-2 shadow-sm',
                    isOwn
                        ? 'rounded-br-md bg-action text-white'
                        : 'rounded-bl-md bg-surface text-ink',
                ]"
            >
                <RouterLink
                    v-if="!isOwn"
                    :to="{
                        name: 'spa.profiles.show',
                        params: { username: comment.user.username },
                    }"
                    class="mb-0.5 block font-semibold text-brand-blue dark:text-ink"
                    @click="$emit('navigate')"
                >
                    {{ comment.user.name }}
                </RouterLink>
                <p class="break-words whitespace-pre-wrap">
                    {{ comment.body }}
                </p>
                <div
                    :class="[
                        'mt-1 flex items-center justify-end gap-2 text-xs',
                        isOwn ? 'text-white/70' : 'text-ink-muted/70',
                    ]"
                >
                    <button
                        v-if="!isOwn"
                        class="flex items-center gap-0.5"
                        @click.stop="$emit('like')"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-3.5"
                            :class="
                                comment.is_liked
                                    ? 'bg-brand-orange'
                                    : 'bg-sand-400 dark:bg-ink'
                            "
                            :style="
                                iconMaskStyle(
                                    comment.is_liked
                                        ? heartFilledIcon
                                        : heartIcon,
                                )
                            "
                        ></span>
                        <span v-if="comment.likes_count > 0">{{
                            comment.likes_count
                        }}</span>
                    </button>
                    <span
                        v-else-if="comment.likes_count > 0"
                        class="flex items-center gap-0.5"
                    >
                        <span
                            aria-hidden="true"
                            class="inline-block size-3.5 bg-surface/60"
                            :style="iconMaskStyle(heartIcon)"
                        ></span>
                        {{ comment.likes_count }}
                    </span>
                    <span>{{ chatTime(comment.created_at) }}</span>
                </div>
            </div>
        </div>
        <RouterLink
            v-if="isOwn"
            :to="{
                name: 'spa.profiles.show',
                params: { username: comment.user.username },
            }"
            class="mt-auto shrink-0"
            @click="$emit('navigate')"
        >
            <img
                :src="
                    comment.user.avatar ??
                    `https://ui-avatars.com/api/?name=${comment.user.name}&background=f0dcc6&color=5c3f24&size=64`
                "
                :alt="comment.user.name"
                class="avatar-ring size-8 rounded-full bg-sand-200 object-cover"
                loading="lazy"
                decoding="async"
            />
        </RouterLink>
    </div>
</template>
