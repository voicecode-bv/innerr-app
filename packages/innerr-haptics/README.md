# Haptics Plugin for NativePHP Mobile

UI haptic feedback for NativePHP Mobile. The core bridge only exposes
`Device.Vibrate`, which on iOS plays `kSystemSoundID_Vibrate` (a full ~400ms
device buzz). This plugin exposes the proper platform feedback generators for
UI micro-interactions: like taps, pull-to-refresh arming, sheet snaps and tab
switches.

| Function | iOS | Android |
|----------|-----|---------|
| `Haptics.Impact` | `UIImpactFeedbackGenerator` (light/medium/heavy/soft/rigid, optional intensity) | Predefined `VibrationEffect` tick/click/heavy-click (API 29+), short one-shot fallback (API 26-28) |
| `Haptics.Notification` | `UINotificationFeedbackGenerator` (success/warning/error) | Short waveform approximations |
| `Haptics.Selection` | `UISelectionFeedbackGenerator` | `EFFECT_TICK` |

Haptics are best-effort: when the device lacks a vibrator, the user disabled
them, or the app runs outside the native runtime, calls succeed silently.

## Requirements

- Android: `android.permission.VIBRATE` (declared by the plugin manifest), min SDK 26
- iOS: no permissions

## Installation

Registered as a path repository in the app's `composer.json`:

```json
{ "type": "path", "url": "packages/innerr-haptics" }
```

```bash
composer require innerr/haptics
```

A native rebuild (`php artisan native:run`) is required after installing so the
bridge functions are compiled in.

## Usage

### JavaScript (SPA)

Use the app-level wrapper `resources/js/spa/utils/haptics.ts`, which no-ops
outside the native runtime:

```ts
import { haptics } from '@/spa/utils/haptics';

haptics.impactLight();          // pull-to-refresh arm, selection-ish taps
haptics.impactMedium();         // likes, sheet dismiss, drawer snap
haptics.selection();            // tab switches, segment changes
haptics.notifySuccess();        // post published
```

Or call the plugin module directly:

```ts
import { Haptics } from '@innerr/haptics';

await Haptics.impact('medium');
await Haptics.notification('success');
await Haptics.selection();
```

### PHP

```php
use Innerr\Haptics\Facades\Haptics;

Haptics::impact('light');
Haptics::notification('success');
Haptics::selection();
```

## License

MIT
