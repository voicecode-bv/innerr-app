import type { Comment } from '@/types/comment';

function getCookie(name: string): string | null {
    const match = document.cookie.match(
        new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'),
    );
    return match ? decodeURIComponent(match[3]) : null;
}

async function request<T>(
    url: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
): Promise<T> {
    const xsrfToken = getCookie('XSRF-TOKEN');

    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export function fetchComments(postId: number): Promise<Comment[]> {
    return request<Comment[]>(`/posts/${postId}/comments`, 'GET');
}

export function postComment(
    postId: number,
    body: string,
    parentCommentId: number | null = null,
): Promise<Comment> {
    return request<Comment>(`/posts/${postId}/comments`, 'POST', {
        body,
        parent_comment_id: parentCommentId,
    });
}
