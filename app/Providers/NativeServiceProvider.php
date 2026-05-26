<?php

namespace App\Providers;

use Codingwithrk\PackageInfo\PackageInfoServiceProvider;
use Developernauts\NativephpInappPurchases\NativephpInappPurchasesServiceProvider;
use Illuminate\Support\ServiceProvider;
use Innerr\NativeMedia\NativeMediaServiceProvider;
use Native\Mobile\Providers\BrowserServiceProvider;
use Native\Mobile\Providers\CameraServiceProvider;
use Native\Mobile\Providers\DeviceServiceProvider;
use Native\Mobile\Providers\DialogServiceProvider;
use Native\Mobile\Providers\NetworkServiceProvider;
use Native\Mobile\Providers\PushNotificationsServiceProvider;
use Native\Mobile\Providers\SecureStorageServiceProvider;
use Native\Mobile\Providers\ShareServiceProvider;
use Native\Mobile\Providers\SystemServiceProvider;
use Voicecode\Mobile\Photos\PhotosServiceProvider;

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
            NativephpInappPurchasesServiceProvider::class,
            SystemServiceProvider::class,
            DeviceServiceProvider::class,
            ShareServiceProvider::class,
            PhotosServiceProvider::class,
            NativeMediaServiceProvider::class,
            \VoicecodeBv\NativephpBadge\NativeBadgeServiceProvider::class,
        
        ];
    }
}
