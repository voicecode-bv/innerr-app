<?php

namespace Innerr\NativeMedia;

/**
 * PHP-side facade target for NativeMedia.
 *
 * The actual work happens in the JS bridge (see resources/js/index.ts) and
 * native code; this PHP class exists primarily so the plugin follows the
 * NativePHP plugin shape (ServiceProvider singleton + Facade) and could be
 * extended later with server-side helpers if needed.
 */
class NativeMedia
{
    /**
     * Directory under which staged media files live. This is relative to
     * `Documents/app/public/` on iOS / the equivalent public assets root on
     * Android, so that they are served via the existing `/_assets/...`
     * scheme handler (with range support and streaming) instead of going
     * through PHP.
     */
    public const STAGE_SUBDIR = '_media';
}
