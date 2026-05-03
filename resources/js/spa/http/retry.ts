/**
 * Retry-with-backoff voor transient failures: netwerkfouten en 5xx server-errors.
 * 4xx blijven direct doorgegooid omdat retry geen zin heeft (validation, 401, etc).
 */
export interface RetryOptions {
    retries?: number;
    backoffMs?: number;
}

export async function withRetry<T>(
    perform: () => Promise<T>,
    isTransient: (error: unknown) => boolean,
    opts: RetryOptions = {},
): Promise<T> {
    const retries = opts.retries ?? 2;
    const backoff = opts.backoffMs ?? 300;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await perform();
        } catch (error) {
            lastError = error;
            if (attempt === retries || !isTransient(error)) {
                throw error;
            }
            await new Promise((resolve) =>
                setTimeout(resolve, backoff * 2 ** attempt),
            );
        }
    }
    throw lastError;
}
