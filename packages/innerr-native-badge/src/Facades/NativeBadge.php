<?php

namespace Innerr\NativeBadge\Facades;

use Illuminate\Support\Facades\Facade;
use Innerr\NativeBadge\NativeBadge as NativeBadgeService;

/**
 * @see NativeBadgeService
 */
class NativeBadge extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return NativeBadgeService::class;
    }
}
