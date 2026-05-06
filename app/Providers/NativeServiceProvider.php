<?php

namespace App\Providers;

use Codingwithrk\PackageInfo\PackageInfoServiceProvider;
use Illuminate\Support\ServiceProvider;
use Native\Mobile\Providers\BrowserServiceProvider;
use Native\Mobile\Providers\CameraServiceProvider;
use Native\Mobile\Providers\DialogServiceProvider;
use Native\Mobile\Providers\NetworkServiceProvider;
use Native\Mobile\Providers\PushNotificationsServiceProvider;
use Native\Mobile\Providers\SecureStorageServiceProvider;

class NativeServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }

    /**
     * The NativePHP plugins to enable.
     *
     * Only plugins listed here will be compiled into your native builds.
     * This is a security measure to prevent transitive dependencies from
     * automatically registering plugins without your explicit consent.
     *
     * @return array<int, class-string<ServiceProvider>>
     */
    public function plugins(): array
    {
        return [
            SecureStorageServiceProvider::class,
            CameraServiceProvider::class,
            DialogServiceProvider::class,
            PushNotificationsServiceProvider::class,
            // \NativePHP\BackgroundTasks\BackgroundTasksServiceProvider::class,
            PackageInfoServiceProvider::class,
            BrowserServiceProvider::class,
            NetworkServiceProvider::class,
            \Developernauts\NativephpInappPurchases\NativephpInappPurchasesServiceProvider::class,
            \Native\Mobile\Providers\SystemServiceProvider::class,
            \Native\Mobile\Providers\DeviceServiceProvider::class,
            \Native\Mobile\Providers\ShareServiceProvider::class,
        
        
        
        

        ];
    }
}
