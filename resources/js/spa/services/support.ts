import { externalApi } from '@/spa/http/externalApi';

/**
 * Send an in-app support request. The message is emailed to the support inbox
 * together with the app version and platform so we have the context needed to
 * help. Throws an ApiError (422 with validation errors, 429 when rate limited)
 * on failure.
 */
export async function sendSupportRequest(
    message: string,
    appVersion: string,
    platform: 'ios' | 'android' | 'web',
): Promise<void> {
    await externalApi.post('/support', {
        message,
        app_version: appVersion,
        platform,
    });
}
