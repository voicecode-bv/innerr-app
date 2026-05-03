export interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface NotificationsPage<T> {
    data: T[];
    meta: PaginationMeta;
}

export async function fetchNotificationsPage<T>(
    page: number,
): Promise<NotificationsPage<T>> {
    const response = await fetch(`/notifications/load?page=${page}`, {
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<NotificationsPage<T>>;
}
