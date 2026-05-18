import flareSourcemapUploader from '@flareapp/vite';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import laravel from 'laravel-vite-plugin';
import { nativephpMobile, nativephpHotFile } from './vendor/nativephp/mobile/resources/js/vite-plugin.js';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@nativephp/mobile': path.resolve(__dirname, 'vendor/nativephp/mobile/resources/dist/native.js'),
            '@innerr/native-media': path.resolve(__dirname, 'packages/innerr-native-media/resources/js/index.ts'),
        },
    },
    build: {
        chunkSizeWarningLimit: 2000,
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/spa/main.ts'],
            refresh: true,
            hotFile: nativephpHotFile(),
        }),
        tailwindcss(),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
        nativephpMobile(),
        flareSourcemapUploader({
            key: 'oMOs3SauYfrkKxMcjjBJim2LHp7rfnnt',
        }),
    ],
});
