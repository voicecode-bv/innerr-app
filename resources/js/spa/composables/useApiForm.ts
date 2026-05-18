import { reactive } from 'vue';
import { api as bffApi, ApiError } from '@/spa/http/apiClient';

type Method = 'post' | 'put' | 'delete';

interface SubmitOptions<R> {
    onSuccess?: (response: R) => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
}

interface FormClient {
    post: <R>(url: string, body?: unknown) => Promise<R>;
    put: <R>(url: string, body?: unknown) => Promise<R>;
    delete: <R>(url: string) => Promise<R>;
}

export function useApiForm<T extends Record<string, unknown>>(
    initial: T,
    client: FormClient = bffApi,
) {
    const initialClone = JSON.parse(JSON.stringify(initial));

    const state = reactive({
        data: { ...initial } as T,
        errors: {} as Record<string, string>,
        processing: false,
        post: <R = unknown>(url: string, opts?: SubmitOptions<R>) =>
            submit<R>('post', url, opts),
        put: <R = unknown>(url: string, opts?: SubmitOptions<R>) =>
            submit<R>('put', url, opts),
        delete: <R = unknown>(url: string, opts?: SubmitOptions<R>) =>
            submit<R>('delete', url, opts),
        reset: (...keys: (keyof T)[]) => {
            if (keys.length === 0) {
                Object.assign(
                    state.data,
                    JSON.parse(JSON.stringify(initialClone)),
                );

                return;
            }

            for (const key of keys) {
                (state.data as Record<string, unknown>)[key as string] =
                    initialClone[key];
            }
        },
    });

    async function submit<R>(
        method: Method,
        url: string,
        opts?: SubmitOptions<R>,
    ): Promise<void> {
        state.processing = true;
        state.errors = {};

        try {
            const response =
                method === 'delete'
                    ? await client.delete<R>(url)
                    : await client[method]<R>(url, state.data);
            opts?.onSuccess?.(response);
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) {
                state.errors = Object.fromEntries(
                    Object.entries(error.errors).map(([key, value]) => [
                        key,
                        value[0] ?? '',
                    ]),
                );
                opts?.onError?.(state.errors);
            } else {
                throw error;
            }
        } finally {
            state.processing = false;
            opts?.onFinish?.();
        }
    }

    return state;
}
