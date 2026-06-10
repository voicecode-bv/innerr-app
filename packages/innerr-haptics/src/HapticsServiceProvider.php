<?php

namespace Innerr\Haptics;

use Illuminate\Support\ServiceProvider;

class HapticsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Haptics::class, fn () => new Haptics);
    }
}
