import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the project's translation conventions:
// - every t('...') key used in source exists in every locale bundle,
// - the locale bundles stay in perfect key parity,
// - no em-dash characters in translation keys or values.

const root = path.resolve(__dirname, '../..');
const locales = ['nl', 'en', 'fr'] as const;

const bundles = Object.fromEntries(
    locales.map((locale) => [
        locale,
        JSON.parse(
            fs.readFileSync(path.join(root, 'lang', `${locale}.json`), 'utf8'),
        ) as Record<string, string>,
    ]),
) as Record<(typeof locales)[number], Record<string, string>>;

function collectSourceFiles(): string[] {
    const exts = new Set(['.vue', '.ts', '.php']);
    const dirs = ['resources/js', 'app', 'routes', 'resources/views'];
    const files: string[] = [];

    function walk(dir: string): void {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                walk(full);

                continue;
            }

            if (
                exts.has(path.extname(entry.name)) &&
                !entry.name.endsWith('.test.ts')
            ) {
                files.push(full);
            }
        }
    }

    dirs.forEach((dir) => walk(path.join(root, dir)));

    return files;
}

// Extracts translation keys passed to t() as string literals. Covers the two
// shapes the codebase uses: a direct literal first argument (possibly on the
// next line) and a ternary picking between two literals (plural forms).
// Dynamic keys (t(variable)) cannot be statically checked and are skipped.
function extractUsedKeys(source: string): string[] {
    const keys: string[] = [];

    const direct = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;

    for (const match of source.matchAll(direct)) {
        keys.push(unescape(match[2], match[1]));
    }

    const ternary =
        /\bt\(\s*[^()'"]*?\?\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*:\s*(['"])((?:\\.|(?!\3)[^\\])*)\3/g;

    for (const match of source.matchAll(ternary)) {
        keys.push(unescape(match[2], match[1]));
        keys.push(unescape(match[4], match[3]));
    }

    return keys;
}

function unescape(literal: string, quote: string): string {
    return literal.replaceAll(`\\${quote}`, quote).replaceAll('\\\\', '\\');
}

const usedKeys = [
    ...new Set(
        collectSourceFiles().flatMap((file) =>
            extractUsedKeys(fs.readFileSync(file, 'utf8')),
        ),
    ),
];

describe('translation bundles', () => {
    it('contain every key used via t() in the source', () => {
        for (const locale of locales) {
            const missing = usedKeys.filter((key) => !(key in bundles[locale]));

            expect(missing, `keys missing from lang/${locale}.json`).toEqual(
                [],
            );
        }
    });

    it('have identical key sets across locales', () => {
        const reference = Object.keys(bundles.en).sort();

        for (const locale of locales) {
            expect(
                Object.keys(bundles[locale]).sort(),
                `lang/${locale}.json key set differs from lang/en.json`,
            ).toEqual(reference);
        }
    });

    it('never contain an em-dash in keys or values', () => {
        for (const locale of locales) {
            const offending = Object.entries(bundles[locale])
                .filter(
                    ([key, value]) => key.includes('—') || value.includes('—'),
                )
                .map(([key]) => key);

            expect(offending, `em-dash found in lang/${locale}.json`).toEqual(
                [],
            );
        }
    });

    it('extracts a sane number of keys (regression guard for the extractor)', () => {
        // If the extractor regresses to matching nothing, the missing-keys
        // assertion above would silently pass. Keep a floor well below the
        // real count (~650) but far above zero.
        expect(usedKeys.length).toBeGreaterThan(400);
    });
});
