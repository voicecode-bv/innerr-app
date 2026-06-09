import { computed } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/spa/stores/auth';

export type BottomNavTab = 'home' | 'circles' | 'add' | 'map' | 'profile' | '';

/**
 * Which tab should be highlighted for a given SPA path. Ported 1:1 from the
 * former EdgeController::resolveActiveTab so behaviour stays identical.
 */
export function resolveActiveTab(path: string): BottomNavTab {
    // The masonry grid feed is a layout variant of Home, so it keeps the Home
    // tab highlighted just like the list feed at '/'.
    if (path === '/' || path === '/feed/grid') {
        return 'home';
    }

    if (path === '/map') {
        return 'map';
    }

    if (/^\/circles\/\d+\/map$/.test(path)) {
        return 'map';
    }

    if (/^\/profiles\/[^/]+\/map$/.test(path)) {
        return 'map';
    }

    // Only the circles index marks the tab active. Pages nested under a specific
    // circle leave the tab inactive so tapping it navigates back to the index
    // instead of being a no-op on an already-active tab.
    if (path === '/circles') {
        return 'circles';
    }

    if (path === '/posts/create' || path === '/quotes/create') {
        return 'add';
    }

    if (path.startsWith('/profiles/')) {
        return 'profile';
    }

    // Pages without a matching tab (notifications, settings, post detail, etc.)
    // leave every tab inactive so tapping any tab still navigates instead of
    // being treated as a no-op tap on an already-active item.
    return '';
}

/**
 * Context-aware target for the Map tab: inside a circle or profile it deep-links
 * to that entity's map, otherwise the global map.
 */
export function resolveMapUrl(path: string): string {
    const circle = path.match(/^\/circles\/(\d+)(?:\/.*)?$/);

    if (circle) {
        return `/circles/${circle[1]}/map`;
    }

    const profile = path.match(/^\/profiles\/([^/]+)(?:\/.*)?$/);

    if (profile) {
        return `/profiles/${profile[1]}/map`;
    }

    return '/map';
}

/**
 * Target for the Profile tab: the current user's profile, or the feed when the
 * username is not (yet) known.
 */
export function resolveProfileUrl(username: string | null | undefined): string {
    return username ? `/profiles/${username}` : '/';
}

/**
 * Routes that take the full viewport and render their own sticky footer, where
 * the bottom nav would get in the way. Ported from EdgeController::shouldHideBottomNav.
 */
export function shouldHideBottomNav(path: string): boolean {
    return (
        path.startsWith('/onboarding/') ||
        path === '/posts/create' ||
        path === '/quotes/create'
    );
}

export function useBottomNav() {
    const auth = useAuthStore();
    const route = useRoute();
    const router = useRouter();

    const isVisible = computed(() => bottomNavVisibleFor(route, auth.user));
    const activeTab = computed<BottomNavTab>(() =>
        resolveActiveTab(route.path),
    );
    const mapUrl = computed(() => resolveMapUrl(route.path));
    const profileUrl = computed(() => resolveProfileUrl(auth.user?.username));

    /**
     * Tapping the tab you're already on scrolls the current page to the top
     * (standard mobile behaviour, AppLayout listens for this) instead of issuing
     * a rejected navigation; otherwise push the target route.
     */
    function navigate(targetPath: string): void {
        if (router.resolve(targetPath).path === route.path) {
            window.dispatchEvent(new CustomEvent('spa:tab-reselect'));

            return;
        }

        router.push(targetPath).catch(() => {
            /* navigation guarded or duplicated */
        });
    }

    return { isVisible, activeTab, mapUrl, profileUrl, navigate };
}

/**
 * Whether the bottom nav should render for the given route and user. Kept as a
 * standalone function so it can be unit-tested and reused from App.vue.
 */
export function bottomNavVisibleFor(
    route: Pick<RouteLocationNormalizedLoaded, 'path' | 'meta'>,
    user: { onboarded: boolean } | null,
): boolean {
    if (!user || !user.onboarded) {
        return false;
    }

    if (route.meta.guest === true || route.meta.public === true) {
        return false;
    }

    if (route.meta.hideEdgeBar === true) {
        return false;
    }

    return !shouldHideBottomNav(route.path);
}
