<?php

namespace App\Providers;

use App\Services\TokenStore\SecureStorageTokenStore;
use App\Services\TokenStore\SessionTokenStore;
use App\Services\TokenStore\TokenStore;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(TokenStore::class, fn (Application $app) => $this->resolveTokenStore($app));
    }

    protected function resolveTokenStore(Application $app): TokenStore
    {
        $key = (string) config('api-client.token_key');
        $driver = (string) config('api-client.token_driver', 'auto');

        if ($driver === 'auto') {
            $driver = $this->detectDriver();
        }

        return match ($driver) {
            'session' => new SessionTokenStore($app['session.store'], $key),
            default => new SecureStorageTokenStore($key),
        };
    }

    protected function detectDriver(): string
    {
        return $this->isRunningOnDevice() ? 'secure_storage' : 'session';
    }

    /**
     * Since nativephp/mobile 3.3.6 a userland nativephp_call() fallback (Jump
     * hybrid mode) is registered on dev machines, so mere existence no longer
     * implies the native runtime. Only the on-device C extension defines it as
     * an internal function.
     */
    protected function isRunningOnDevice(): bool
    {
        return function_exists('nativephp_call')
            && (new \ReflectionFunction('nativephp_call'))->isInternal();
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
