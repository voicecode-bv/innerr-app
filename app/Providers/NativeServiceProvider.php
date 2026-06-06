<?php

namespace App\Providers;

use Codingwithrk\PackageInfo\PackageInfoServiceProvider;
use Developernauts\NativephpInappPurchases\NativephpInappPurchasesServiceProvider;
use Developernauts\NativephpMobileLocales\NativephpMobileLocalesServiceProvider;
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
use NativePHP\BackgroundTasks\BackgroundTasksServiceProvider;
use Voicecode\Mobile\Photos\PhotosServiceProvider;
use VoicecodeBv\NativephpAnimatedSplash\AnimatedSplashServiceProvider;
use VoicecodeBv\NativephpBadge\NativeBadgeServiceProvider;

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
            BackgroundTasksServiceProvider::class,
            PackageInfoServiceProvider::class,
            BrowserServiceProvider::class,
            NetworkServiceProvider::class,
            NativephpInappPurchasesServiceProvider::class,
            SystemServiceProvider::class,
            DeviceServiceProvider::class,
            ShareServiceProvider::class,
            PhotosServiceProvider::class,
            NativeMediaServiceProvider::class,
            NativeBadgeServiceProvider::class,
            AnimatedSplashServiceProvider::class,
            NativephpMobileLocalesServiceProvider::class,
            \Nativephp\InAppReviews\InAppReviewsServiceProvider::class,
        

        ];
    }
}
