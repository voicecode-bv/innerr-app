import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiPost = vi.fn();

vi.mock('@/spa/http/externalApi', () => ({
    externalApi: {
        post: (path: string, body: unknown) => apiPost(path, body),
    },
}));

const { sendSupportRequest } = await import('./support');

beforeEach(() => {
    apiPost.mockReset();
    apiPost.mockResolvedValue(undefined);
});

describe('sendSupportRequest', () => {
    it('posts the message, app version and platform to the support endpoint', async () => {
        await sendSupportRequest('It crashes on launch', '1.2.3', 'ios');

        expect(apiPost).toHaveBeenCalledWith('/support', {
            message: 'It crashes on launch',
            app_version: '1.2.3',
            platform: 'ios',
        });
    });

    it('propagates API errors to the caller', async () => {
        apiPost.mockRejectedValueOnce(new Error('boom'));

        await expect(
            sendSupportRequest('hi', '1.0.0', 'android'),
        ).rejects.toThrow('boom');
    });
});
