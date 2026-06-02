<?php

namespace App\Http\Controllers\Spa;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Native\Mobile\Edge\Edge;

class EdgeController extends Controller
{
    public function setActiveTab(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'path' => ['required', 'string'],
        ]);

        $path = $this->normalizePath($validated['path']);

        if ($this->shouldHideBottomNav($path)) {
            Edge::clear();

            return response()->json(['cleared' => true]);
        }

        $activeTab = $this->resolveActiveTab($path);
        $mapUrl = $this->resolveMapUrl($path);
        $profileUrl = $this->resolveProfileUrl($request);

        $this->setupBottomNav($activeTab, $mapUrl, $profileUrl);

        return response()->json(['active' => $activeTab]);
    }

    protected function normalizePath(string $path): string
    {
        $parsed = parse_url($path, PHP_URL_PATH) ?: $path;

        return '/'.ltrim($parsed, '/');
    }

    protected function isOnboardingPath(string $path): bool
    {
        return str_starts_with($path, '/onboarding/');
    }

    protected function shouldHideBottomNav(string $path): bool
    {
        // Onboarding + de create-post/quote wizards nemen de volledige hoogte:
        // de native bottom-bar zit in de weg van hun eigen sticky footer.
        return $this->isOnboardingPath($path)
            || $path === '/posts/create'
            || $path === '/quotes/create';
    }

    protected function resolveActiveTab(string $path): string
    {
        return match (true) {
            // The masonry grid feed is a layout variant of Home, so it keeps
            // the Home tab highlighted just like the list feed at '/'.
            $path === '/' || $path === '/feed/grid' => 'home',
            $path === '/map' => 'map',
            preg_match('#^/circles/\d+/map$#', $path) === 1 => 'map',
            preg_match('#^/profiles/[^/]+/map$#', $path) === 1 => 'map',
            // Only the circles index marks the tab active. Pages nested under a
            // specific circle leave the tab inactive so tapping it navigates
            // back to the index instead of being a no-op on an already-active
            // tab.
            $path === '/circles' => 'circles',
            $path === '/posts/create' || $path === '/quotes/create' => 'add',
            str_starts_with($path, '/profiles/') => 'profile',
            // Pages without a matching tab (notifications, settings, post detail,
            // etc.) leave every tab inactive so tapping any tab — including Home
            // — still navigates instead of being treated as a no-op tap on an
            // already-active item.
            default => '',
        };
    }

    protected function resolveMapUrl(string $path): string
    {
        if (preg_match('#^/circles/(\d+)(?:/.*)?$#', $path, $matches) === 1) {
            return url('/circles/'.$matches[1].'/map');
        }

        if (preg_match('#^/profiles/([^/]+)(?:/.*)?$#', $path, $matches) === 1) {
            return url('/profiles/'.$matches[1].'/map');
        }

        return url('/map');
    }

    protected function resolveProfileUrl(Request $request): string
    {
        $username = $request->user()?->username;

        return $username
            ? url('/profiles/'.$username)
            : url('/');
    }

    protected function setupBottomNav(string $activeTab, string $mapUrl, string $profileUrl): void
    {
        $contextIndex = Edge::startContext();

        Edge::add('bottom_nav_item', [
            'id' => 'home',
            'icon' => 'home',
            'label' => __('Home'),
            'url' => url('/'),
            'active' => $activeTab === 'home',
            'badge' => null,
            'badge_color' => null,
            'news' => false,
        ]);

        Edge::add('bottom_nav_item', [
            'id' => 'circles',
            'icon' => 'person.2.fill',
            'label' => __('Circles'),
            'url' => url('/circles'),
            'active' => $activeTab === 'circles',
            'badge' => null,
            'badge_color' => null,
            'news' => false,
        ]);

        Edge::add('bottom_nav_item', [
            'id' => 'add',
            'icon' => 'camera',
            'label' => __('New'),
            'url' => url('/posts/create'),
            'active' => $activeTab === 'add',
            'badge' => null,
            'badge_color' => null,
            'news' => false,
        ]);

        Edge::add('bottom_nav_item', [
            'id' => 'map',
            'icon' => 'map',
            'label' => __('Map'),
            'url' => $mapUrl,
            'active' => $activeTab === 'map',
            'badge' => null,
            'badge_color' => null,
            'news' => false,
        ]);

        Edge::add('bottom_nav_item', [
            'id' => 'profile',
            'icon' => 'person.crop.circle',
            'label' => __('Profile'),
            'url' => $profileUrl,
            'active' => $activeTab === 'profile',
            'badge' => null,
            'badge_color' => null,
            'news' => false,
        ]);

        Edge::endContext($contextIndex, 'bottom_nav', [
            'id' => 'bottom_nav',
            'dark' => null,
            'label_visibility' => 'labeled',
            'active_color' => null,
        ]);

        Edge::set();
    }
}
