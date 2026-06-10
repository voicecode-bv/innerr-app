<?php

namespace Innerr\Haptics\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static bool impact(string $style = 'light')
 * @method static bool notification(string $type = 'success')
 * @method static bool selection()
 *
 * @see \Innerr\Haptics\Haptics
 */
class Haptics extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \Innerr\Haptics\Haptics::class;
    }
}
