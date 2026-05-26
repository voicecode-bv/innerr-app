<?php

namespace Innerr\NativeBadge;

use Illuminate\Support\ServiceProvider;

class NativeBadgeServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(NativeBadge::class, fn () => new NativeBadge);
    }
}
