import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Standalone test config (not the app's vite.config) so the Laravel/Tailwind/
// NativePHP build plugins don't run during unit tests. Mirrors the `@` and the
// vendor package aliases that the app relies on (kept in sync with the
// `resolve.alias` block in vite.config.ts).
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
            '@nativephp/mobile': path.resolve(
                __dirname,
                'vendor/nativephp/mobile/resources/dist/native.js',
            ),
            '@innerr/haptics': path.resolve(
                __dirname,
                'packages/innerr-haptics/resources/js/index.ts',
            ),
            '@innerr/native-media': path.resolve(
                __dirname,
                'packages/innerr-native-media/resources/js/index.ts',
            ),
            '@voicecode-bv/nativephp-badge': path.resolve(
                __dirname,
                'vendor/voicecode-bv/nativephp-badge/resources/js/index.ts',
            ),
            '@voicecode-bv/nativephp-animated-splash': path.resolve(
                __dirname,
                'vendor/voicecode-bv/nativephp-animated-splash/resources/js/index.ts',
            ),
        },
    },
    test: {
        environment: 'happy-dom',
        include: ['resources/js/**/*.test.ts'],
    },
});
