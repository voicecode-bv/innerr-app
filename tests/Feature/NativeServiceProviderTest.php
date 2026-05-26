<?php

use App\Providers\NativeServiceProvider;
use NativePHP\BackgroundTasks\BackgroundTasksServiceProvider;

it('compiles the background tasks plugin into native builds', function () {
    $provider = new NativeServiceProvider($this->app);

    expect($provider->plugins())->toContain(BackgroundTasksServiceProvider::class);
});
