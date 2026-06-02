import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Standalone test config (not the app's vite.config) so the Laravel/Tailwind/
// NativePHP build plugins don't run during unit tests. Mirrors the `@` and
// `@nativephp/mobile` aliases that the app relies on.
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
            '@nativephp/mobile': path.resolve(
                __dirname,
                'vendor/nativephp/mobile/resources/dist/native.js',
            ),
        },
    },
    test: {
        environment: 'happy-dom',
        include: ['resources/js/**/*.test.ts'],
    },
});
