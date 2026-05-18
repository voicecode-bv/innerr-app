<?php

namespace Innerr\NativeMedia\Facades;

use Illuminate\Support\Facades\Facade;
use Innerr\NativeMedia\NativeMedia as NativeMediaService;

/**
 * @see NativeMediaService
 */
class NativeMedia extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return NativeMediaService::class;
    }
}
