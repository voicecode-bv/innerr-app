/**
 * Renders a kid's quote onto a square canvas (gradient background, optional
 * doodle pattern, the quote text, and attribution) and exports it as a JPEG
 * blob. The blob feeds straight into the existing chunked-upload + posts
 * pipeline, so a quote becomes an ordinary image post carrying extra
 * `type`/`quote_text`/`quote_author` fields.
 *
 * Backgrounds are brand-palette gradients only (no shipped raster assets). Some
 * presets layer a pattern built from the app's doodle icons, recoloured to the
 * preset's text colour at low opacity so the quote stays legible. Each preset
 * pins its own text colour for contrast — e.g. yellow surfaces pair with
 * brand-blue text, never a light colour.
 */

// Doodle sources are imported as raw SVG markup (Vite `?raw`) so we can recolour
// them to any text colour before rasterising. Only the motifs used by a preset
// are imported, to keep them out of bundles that never render a quote.
import balloonDoodle from '../../../svg/doodle-icons/balloon.svg?raw';
import cakeDoodle from '../../../svg/doodle-icons/cake.svg?raw';
import candyDoodle from '../../../svg/doodle-icons/candy.svg?raw';
import cloudDoodle from '../../../svg/doodle-icons/cloud.svg?raw';
import giftDoodle from '../../../svg/doodle-icons/gift.svg?raw';
import heartFilledDoodle from '../../../svg/doodle-icons/heart-filled.svg?raw';
import heartDoodle from '../../../svg/doodle-icons/heart.svg?raw';
import iceCreamDoodle from '../../../svg/doodle-icons/ice-cream.svg?raw';
import musicDoodle from '../../../svg/doodle-icons/music.svg?raw';
import noteDoodle from '../../../svg/doodle-icons/note.svg?raw';
import starDoodle from '../../../svg/doodle-icons/star.svg?raw';
import sunDoodle from '../../../svg/doodle-icons/sun.svg?raw';

/** Default output edge length in pixels. Square keeps the layout on-brand. */
const SIZE = 1080;

/** Raw SVG markup per doodle key, referenced by `QuoteGradient.doodles`. */
const DOODLE_SOURCES: Record<string, string> = {
    heart: heartDoodle,
    'heart-filled': heartFilledDoodle,
    star: starDoodle,
    cloud: cloudDoodle,
    sun: sunDoodle,
    balloon: balloonDoodle,
    gift: giftDoodle,
    'ice-cream': iceCreamDoodle,
    candy: candyDoodle,
    cake: cakeDoodle,
    music: musicDoodle,
    note: noteDoodle,
};

export interface QuoteGradient {
    /** Stable id persisted with the draft / sent for analytics, never shown. */
    id: string;
    /** Two diagonal gradient stops. */
    from: string;
    to: string;
    /** Text colour chosen for contrast against this gradient. */
    text: string;
    /**
     * Optional doodle motif keys (into DOODLE_SOURCES). When present, the icons
     * are scattered across the background, recoloured to `text` at low opacity.
     */
    doodles?: string[];
}

/**
 * Brand-palette backgrounds. Colours mirror the `--color-brand-*` tokens in
 * resources/css/app.css. The first six are plain gradients; the rest layer a
 * doodle pattern. Text colour is fixed per preset so a quote stays legible
 * regardless of which background the user picks.
 */
export const QUOTE_GRADIENTS: QuoteGradient[] = [
    { id: 'dusk', from: '#373d8a', to: '#4a52a8', text: '#fcfaf3' },
    { id: 'meadow', from: '#4e9e3e', to: '#373d8a', text: '#ffffff' },
    { id: 'forest', from: '#5bb048', to: '#3a7a2e', text: '#fcfaf3' },
    { id: 'sunrise', from: '#f49710', to: '#f5eb69', text: '#373d8a' },
    { id: 'sunshine', from: '#f5eb69', to: '#f7d65a', text: '#373d8a' },
    { id: 'sand', from: '#fcfaf3', to: '#efe7cf', text: '#373d8a' },
    {
        id: 'hearts',
        from: '#f7a13a',
        to: '#f5eb69',
        text: '#373d8a',
        doodles: ['heart', 'heart-filled'],
    },
    {
        id: 'starry',
        from: '#2b3170',
        to: '#4a52a8',
        text: '#fcfaf3',
        doodles: ['star'],
    },
    {
        id: 'sky',
        from: '#373d8a',
        to: '#6e76c2',
        text: '#fcfaf3',
        doodles: ['cloud', 'sun'],
    },
    {
        id: 'party',
        from: '#4e9e3e',
        to: '#373d8a',
        text: '#ffffff',
        doodles: ['balloon', 'gift', 'star'],
    },
    {
        id: 'sweet',
        from: '#f5eb69',
        to: '#f7d65a',
        text: '#373d8a',
        doodles: ['ice-cream', 'candy', 'cake'],
    },
    {
        id: 'melody',
        from: '#5bb048',
        to: '#3a7a2e',
        text: '#fcfaf3',
        doodles: ['music', 'note', 'heart'],
    },
];

export interface RenderQuoteOptions {
    text: string;
    author?: string | null;
    gradient: QuoteGradient;
}

export interface RenderedQuote {
    blob: Blob;
    dataUrl: string;
}

/**
 * The fonts are loaded over the network (bunny.net) via the app stylesheet.
 * Canvas text falls back to a system font if we draw before they arrive, so we
 * explicitly wait for the weights we use. Best-effort: a font that never loads
 * must not block rendering.
 */
async function ensureFontsLoaded(): Promise<void> {
    if (typeof document === 'undefined' || !('fonts' in document)) {
        return;
    }

    try {
        await Promise.all([
            document.fonts.load('900 80px Fraunces'),
            document.fonts.load('600 32px "DM Sans"'),
        ]);
    } catch {
        // Ignore — we render with whatever is available.
    }
}

/**
 * Recolour a doodle SVG to `color` and return it as a data URL. The icons fill
 * their path with `currentColor` or a solid black/`#000`; the clipPath's white
 * rect is a mask definition (never rendered) and is left untouched.
 */
function recolouredDoodleDataUrl(raw: string, color: string): string {
    const recoloured = raw.replace(
        /fill="(currentColor|black|#000000|#000)"/gi,
        `fill="${color}"`,
    );

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(recoloured)}`;
}

// Decoded doodle images are cached per key+colour: live preview re-renders on
// every keystroke, so we must not re-decode the same SVG each time.
const doodleImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadDoodleImage(
    key: string,
    color: string,
): Promise<HTMLImageElement> {
    const cacheKey = `${key}|${color}`;
    const cached = doodleImageCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const raw = DOODLE_SOURCES[key];

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        if (!raw) {
            reject(new Error(`Unknown doodle: ${key}`));

            return;
        }

        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
            reject(new Error(`Failed to load doodle: ${key}`));
        image.src = recolouredDoodleDataUrl(raw, color);
    });

    doodleImageCache.set(cacheKey, promise);

    return promise;
}

/**
 * Draw a scattered doodle pattern across the whole canvas. Positions follow a
 * staggered grid with a deterministic per-cell tilt and size, so the result is
 * lively but identical between the picker thumbnail and the final render.
 */
async function drawDoodlePattern(
    ctx: CanvasRenderingContext2D,
    keys: string[],
    color: string,
    size: number,
): Promise<void> {
    if (keys.length === 0) {
        return;
    }

    let images: HTMLImageElement[];

    try {
        images = await Promise.all(
            keys.map((key) => loadDoodleImage(key, color)),
        );
    } catch {
        // A missing motif must not abort the whole render.
        return;
    }

    const cols = 4;
    const rows = 4;
    const cellW = size / cols;
    const cellH = size / rows;

    ctx.save();
    ctx.globalAlpha = 0.12;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const index = row * cols + col;
            const image = images[index % images.length];

            // Stagger alternate rows and add a small deterministic tilt so the
            // grid never looks mechanical.
            const offsetX = row % 2 === 0 ? -cellW * 0.1 : cellW * 0.25;
            const x = col * cellW + cellW * 0.5 + offsetX;
            const y = row * cellH + cellH * 0.5;
            const rotation = ((index % 4) - 1.5) * 0.18;
            const target = cellW * (0.42 + (index % 3) * 0.06);

            const ratio = image.naturalWidth / image.naturalHeight || 1;
            const drawW = ratio >= 1 ? target : target * ratio;
            const drawH = ratio >= 1 ? target / ratio : target;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        }
    }

    ctx.restore();
}

/**
 * Greedily wrap `text` into lines no wider than `maxWidth` at the current font.
 *
 * @returns array of lines
 */
function wrapLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
): string[] {
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        const candidate = current === '' ? word : `${current} ${word}`;

        if (ctx.measureText(candidate).width <= maxWidth || current === '') {
            current = candidate;
        } else {
            lines.push(current);
            current = word;
        }
    }

    if (current !== '') {
        lines.push(current);
    }

    return lines;
}

/**
 * Pick the largest quote font size (scaled to the canvas) whose wrapped lines
 * all fit inside the target text box. Shorter quotes render big and bold; longer
 * ones step down so everything stays on the canvas.
 *
 * @returns the chosen font size and the wrapped lines at that size
 */
function fitQuote(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number,
    size: number,
): { fontSize: number; lines: string[] } {
    const max = Math.round(96 * (size / SIZE));
    const min = Math.round(40 * (size / SIZE));
    const step = Math.max(2, Math.round(4 * (size / SIZE)));
    let chosen = { fontSize: min, lines: [text] };

    for (let fontSize = max; fontSize >= min; fontSize -= step) {
        ctx.font = `900 ${fontSize}px Fraunces, Georgia, serif`;
        const lines = wrapLines(ctx, text, maxWidth);
        const lineHeight = fontSize * 1.2;

        if (lines.length * lineHeight <= maxHeight) {
            return { fontSize, lines };
        }

        chosen = { fontSize, lines };
    }

    return chosen;
}

/**
 * Render the quote and return both a JPEG blob (for upload) and a data URL (for
 * an instant preview / optimistic feed thumbnail). `size` controls the output
 * edge length — pass a small value for picker thumbnails.
 */
export async function renderQuote(
    options: RenderQuoteOptions,
    size: number = SIZE,
): Promise<RenderedQuote> {
    await ensureFontsLoaded();

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
    }

    const { from, to, text: textColor, doodles } = options.gradient;
    const hasDoodles = !!doodles && doodles.length > 0;

    // Diagonal gradient background.
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    if (hasDoodles) {
        await drawDoodlePattern(ctx, doodles!, textColor, size);
    }

    const padding = size * 0.12;
    const maxWidth = size - padding * 2;

    // Oversized decorative opening quotation mark, low opacity, top-left. The
    // doodle pattern is already the decoration on those backgrounds, so the mark
    // is only drawn on the plain gradients.
    if (!hasDoodles) {
        ctx.fillStyle = textColor;
        ctx.globalAlpha = 0.18;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `900 ${320 * (size / SIZE)}px Fraunces, Georgia, serif`;
        ctx.fillText('“', padding * 0.5, -padding * 0.4);
        ctx.globalAlpha = 1;
    }

    // Reserve vertical room for the author line so the quote never collides.
    const hasAuthor = !!options.author && options.author.trim() !== '';
    const authorReserve = hasAuthor ? size * 0.16 : 0;
    const maxTextHeight = size - padding * 2 - authorReserve;

    const trimmed = options.text.trim();
    const { fontSize, lines } = fitQuote(
        ctx,
        trimmed,
        maxWidth,
        maxTextHeight,
        size,
    );
    const lineHeight = fontSize * 1.2;

    // Vertically centre the quote block within the area above the author.
    ctx.font = `900 ${fontSize}px Fraunces, Georgia, serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const blockHeight = lines.length * lineHeight;
    const centerY =
        padding + (maxTextHeight - blockHeight) / 2 + lineHeight / 2;

    lines.forEach((line, index) => {
        ctx.fillText(line, size / 2, centerY + index * lineHeight, maxWidth);
    });

    if (hasAuthor) {
        const author = options.author!.trim();
        const authorY = size - padding;

        // Short separator line above the name.
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 3 * (size / SIZE);
        ctx.beginPath();
        ctx.moveTo(size / 2 - size * 0.037, authorY - size * 0.052);
        ctx.lineTo(size / 2 + size * 0.037, authorY - size * 0.052);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.font = `600 ${36 * (size / SIZE)}px "DM Sans", system-ui, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(author, size / 2, authorY, maxWidth);
    }

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.92);
    });

    if (!blob) {
        throw new Error('Failed to export quote canvas');
    }

    return { blob, dataUrl: canvas.toDataURL('image/jpeg', 0.92) };
}
