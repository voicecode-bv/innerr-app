import { ApiError, NetworkError, parseRetryAfter } from '@/spa/http/apiClient';
import { withRetry } from '@/spa/http/retry';

export { ApiError };

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

// Resolver i.p.v. een vaste string: de base-url kan al uit de durable snapshot
// komen vóór de bootstrap-call hem ververst, zodat externe calls ook werken
// wanneer de bootstrap (offline) faalt.
let baseUrlResolver: (() => string) | null = null;
let authResolver: (() => AuthLike) | null = null;
let localeResolver: (() => string) | null = null;
let appVersionResolver: (() => string) | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function configureExternalApi(opts: {
    baseUrl: () => string;
    auth: () => AuthLike;
    locale: () => string;
    appVersion: () => string;
    onUnauthorized: () => void;
}): void {
    baseUrlResolver = opts.baseUrl;
    authResolver = opts.auth;
    localeResolver = opts.locale;
    appVersionResolver = opts.appVersion;
    unauthorizedHandler = opts.onUnauthorized;
}

async function performCall<T>(
    method: string,
    path: string,
    body?: unknown,
): Promise<T> {
    const baseUrl = (baseUrlResolver?.() ?? '').replace(/\/+$/, '');

    if (!baseUrl) {
        throw new Error(
            'externalApi not configured. Call configureExternalApi first.',
        );
    }

    const auth = authResolver?.();
    const locale = localeResolver?.();
    const appVersion = appVersionResolver?.();
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (auth?.token) {
        headers.Authorization = `Bearer ${auth.token}`;
    }

    if (locale) {
        headers['Accept-Language'] = locale;
    }

    if (appVersion) {
        headers['X-App-Version'] = appVersion;
    }

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

    let response: globalThis.Response;

    try {
        response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            credentials: 'omit',
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

    const text = await response.text();

    if (text.length === 0) {
        return undefined as T;
    }

    return JSON.parse(text) as T;
}

function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    // Alleen GETs retryen — mutaties zijn niet idempotent.
    if (method === 'GET') {
        return withRetry(() => performCall<T>(method, path, body), isTransient);
    }

    return performCall<T>(method, path, body);
}

export const externalApi = {
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, body?: unknown) =>
        call<T>('POST', path, body ?? {}),
    put: <T>(path: string, body?: unknown) => call<T>('PUT', path, body ?? {}),
    patch: <T>(path: string, body?: unknown) =>
        call<T>('PATCH', path, body ?? {}),
    delete: <T>(path: string) => call<T>('DELETE', path),
};
