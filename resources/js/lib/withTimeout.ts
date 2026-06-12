/**
 * Bounds a promise that may never settle on its own (NativePHP bridge calls
 * and plain fetch() have no client-side timeout): rejects with `makeError()`
 * once `ms` elapses. The underlying promise keeps running; its eventual
 * result is ignored.
 *
 * Without a `window` (SSR) the promise is returned unbounded, mirroring the
 * other timer helpers in the codebase.
 */
export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    makeError: () => Error,
): Promise<T> {
    if (typeof window === 'undefined') {
        return promise;
    }

    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(makeError()), ms);

        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                window.clearTimeout(timer);
                reject(
                    error instanceof Error ? error : new Error(String(error)),
                );
            },
        );
    });
}
