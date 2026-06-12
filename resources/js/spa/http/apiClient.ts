import { withRetry } from '@/spa/http/retry';

export class ApiError extends Error {
    constructor(
        public status: number,
        public errors: Record<string, string[]> = {},
        message: string,
        public retryAfterSeconds: number | null = null,
        public url: string | null = null,
    ) {
        super(message);
    }
}

// Parse Retry-After header. Spec: either a number of seconds or an
// HTTP-date. Returns null for a missing or unparseable value.
export function parseRetryAfter(header: string | null): number | null {
    if (!header) {
        return null;
    }

    const seconds = Number(header);

    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.ceil(seconds);
    }

    const dateMs = Date.parse(header);

    if (Number.isFinite(dateMs)) {
        return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
    }

    return null;
}

export class NetworkError extends Error {
    constructor(message = 'Network error') {
        super(message);
    }
}

function isTransient(error: unknown): boolean {
    if (error instanceof NetworkError) {
        return true;
    }

    if (error instanceof ApiError) {
        return (
            error.status === 503 || error.status === 504 || error.status === 0
        );
    }

    return false;
}

interface AuthLike {
    token: string | null;
    clear(): void;
}

let authResolver: (() => AuthLike) | null = null;
let localeResolver: (() => string) | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function configureApiClient(opts: {
    auth: () => AuthLike;
    locale: () => string;
    onUnauthorized: () => void;
}): void {
    authResolver = opts.auth;
    localeResolver = opts.locale;
    unauthorizedHandler = opts.onUnauthorized;
}

async function performCall<T>(
    method: string,
    url: string,
    body?: unknown,
): Promise<T> {
    const auth = authResolver?.();
    const locale = localeResolver?.();
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (auth?.token) {
        headers.Authorization = `Bearer ${auth.token}`;
    }

    if (locale) {
        headers['Accept-Language'] = locale;
    }

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const xsrf = readCookie('XSRF-TOKEN');

    if (xsrf) {
        headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    }

    let response: globalThis.Response;

    try {
        response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            credentials: 'same-origin',
            cache: 'no-store',
        });
    } catch {
        throw new NetworkError();
    }

    if (response.status === 401) {
        auth?.clear();
        unauthorizedHandler?.();

        throw new ApiError(401, {}, 'Unauthorized');
    }

    if (response.status === 422) {
        const data = await response.json().catch(() => ({}));

        throw new ApiError(
            422,
            data.errors ?? {},
            data.message ?? 'Validation failed',
        );
    }

    if (response.status === 429) {
        const data = await response.json().catch(() => ({}));

        throw new ApiError(
            429,
            {},
            data.message ?? `HTTP 429`,
            parseRetryAfter(response.headers.get('Retry-After')),
            url,
        );
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new ApiError(
            response.status,
            {},
            data.message ?? `HTTP ${response.status}`,
        );
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}

function call<T>(method: string, url: string, body?: unknown): Promise<T> {
    // Only retry GETs — mutations are not idempotent.
    if (method === 'GET') {
        return withRetry(() => performCall<T>(method, url, body), isTransient);
    }

    return performCall<T>(method, url, body);
}

function readCookie(name: string): string | null {
    const match = document.cookie.match(
        new RegExp('(^|;\\s*)' + name + '=([^;]*)'),
    );

    return match ? match[2] : null;
}

export const api = {
    get: <T>(url: string) => call<T>('GET', url),
    post: <T>(url: string, body?: unknown) => call<T>('POST', url, body ?? {}),
    put: <T>(url: string, body?: unknown) => call<T>('PUT', url, body ?? {}),
    delete: <T>(url: string) => call<T>('DELETE', url),
};
