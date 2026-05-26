<?php

namespace Innerr\NativeBadge;

/**
 * PHP-side facade target for NativeBadge.
 *
 * The actual work happens in the JS bridge (see resources/js/index.ts) and
 * native code; this PHP class exists primarily so the plugin follows the
 * NativePHP plugin shape (ServiceProvider singleton + Facade) and could be
 * extended later with server-side helpers if needed.
 */
class NativeBadge
{
    /**
     * Bridge function name used to set the app icon badge counter.
     */
    public const SET_FUNCTION = 'Badge.Set';
}
