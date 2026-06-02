import { describe, expect, it } from 'vitest';
import { isNativeRuntime } from './usePlatform';

function setUrl(url: string): void {
    (
        window as unknown as { happyDOM: { setURL(u: string): void } }
    ).happyDOM.setURL(url);
}

describe('isNativeRuntime', () => {
    it('detects the iOS php:// scheme as native', () => {
        setUrl('php://127.0.0.1/');

        expect(isNativeRuntime()).toBe(true);
    });

    it('detects the Android 127.0.0.1 host as native', () => {
        setUrl('http://127.0.0.1/feed');

        expect(isNativeRuntime()).toBe(true);
    });

    it('treats a real domain as web', () => {
        setUrl('https://innerr-app.test/feed');

        expect(isNativeRuntime()).toBe(false);
    });

    it('treats localhost as web', () => {
        setUrl('http://localhost/');

        expect(isNativeRuntime()).toBe(false);
    });
});
