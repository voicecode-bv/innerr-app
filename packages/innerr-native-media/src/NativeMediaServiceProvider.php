<?php

namespace Innerr\NativeMedia;

use Illuminate\Support\ServiceProvider;

class NativeMediaServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(NativeMedia::class, fn () => new NativeMedia);
    }
}
