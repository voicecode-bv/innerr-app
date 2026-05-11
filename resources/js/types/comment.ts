export interface CommentUser {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
}

export interface Comment {
    id: string;
    body: string;
    created_at: string;
    user: CommentUser;
    likes_count: number;
    is_liked: boolean;
}
