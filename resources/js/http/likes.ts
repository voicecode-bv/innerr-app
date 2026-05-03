export interface LikeUser {
    id: number;
    name: string;
    username: string;
    avatar: string | null;
}

export interface LikesPage {
    data: LikeUser[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(
        new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'),
    );
    return match ? decodeURIComponent(match[3]) : null;
}

async function sendLike(url: string, method: 'POST' | 'DELETE'): Promise<void> {
    const xsrfToken = getCookie('XSRF-TOKEN');
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
}

export const likePost = (postId: number) =>
    sendLike(`/posts/${postId}/like`, 'POST');
export const unlikePost = (postId: number) =>
    sendLike(`/posts/${postId}/like`, 'DELETE');
export const likeComment = (commentId: number) =>
    sendLike(`/comments/${commentId}/like`, 'POST');
export const unlikeComment = (commentId: number) =>
    sendLike(`/comments/${commentId}/like`, 'DELETE');

export async function fetchPostLikes(
    postId: number,
    page = 1,
): Promise<LikesPage> {
    const response = await fetch(`/posts/${postId}/likes?page=${page}`, {
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<LikesPage>;
}
