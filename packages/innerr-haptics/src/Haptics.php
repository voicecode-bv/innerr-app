<?php

namespace Innerr\Haptics;

/**
 * PHP-side facade target for Haptics.
 *
 * The app triggers haptics from the JS bridge (see resources/js/index.ts);
 * these helpers exist so server-rendered or Livewire-style flows could fire
 * the same feedback, and so the plugin follows the NativePHP plugin shape.
 */
class Haptics
{
    /**
     * Play a physical impact haptic.
     *
     * @param  'light'|'medium'|'heavy'|'soft'|'rigid'  $style
     */
    public function impact(string $style = 'light'): bool
    {
        return $this->call('Haptics.Impact', ['style' => $style]);
    }

    /**
     * Play a notification haptic.
     *
     * @param  'success'|'warning'|'error'  $type
     */
    public function notification(string $type = 'success'): bool
    {
        return $this->call('Haptics.Notification', ['type' => $type]);
    }

    /**
     * Play the subtle selection-changed tick.
     */
    public function selection(): bool
    {
        return $this->call('Haptics.Selection', []);
    }

    /**
     * @param  array<string, mixed>  $parameters
     */
    private function call(string $function, array $parameters): bool
    {
        if (! function_exists('nativephp_call')) {
            return false;
        }

        $result = nativephp_call($function, json_encode($parameters) ?: '{}');

        if (! $result) {
            return false;
        }

        $decoded = json_decode($result, true);

        return isset($decoded['success']) && $decoded['success'] === true;
    }
}
