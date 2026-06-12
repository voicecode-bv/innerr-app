<script setup lang="ts">
import { useRouter } from 'vue-router';
import Button from '@/components/Button.vue';
import type { PostData } from '@/spa/components/PostCard.vue';
import { useTranslations } from '@/spa/composables/useTranslations';
import { useFeedSelectionStore } from '@/spa/stores/feedSelection';
import { usePrintShopStore } from '@/spa/stores/printShop';

/**
 * The bar that slides up while a photo selection is in progress. Shared by
 * every selectable feed surface (masonry grid, list feed); the action it
 * offers follows the selection intent. The circle assignment itself stays
 * with the host (it owns the sheet), so that action is only emitted.
 */
const props = defineProps<{
    /** Posts on the hosting surface; the print flow snapshots photos from these. */
    posts: PostData[];
}>();

const emit = defineEmits<{
    (e: 'addToCircle'): void;
}>();

const { t } = useTranslations();
const router = useRouter();
const selection = useFeedSelectionStore();
const printShop = usePrintShopStore();

// Hands the selected photos over to the print shop store and opens the shop.
// The page navigation tears the selection down via the page's unmount hook.
function startPrintFlow(): void {
    const selectedPosts = props.posts.filter((post) =>
        selection.selectedIds.has(post.id),
    );

    if (selectedPosts.length === 0) {
        return;
    }

    printShop.setPhotosFromPosts(selectedPosts);
    void router.push({ name: 'spa.print.shop' });
}
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-full"
            enter-to-class="translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0"
            leave-to-class="translate-y-full"
        >
            <!-- Anchored just above the bottom nav (z-40 keeps it behind the
                 z-50 nav, so it slides out from underneath it) instead of
                 padding its way over it, so there is no dead space below the
                 content and the nav stays usable. -->
            <div
                v-if="selection.active && selection.count > 0"
                class="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+var(--inset-bottom,0px))] z-40 flex items-center justify-between gap-3 border-t border-sand-200 bg-surface px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
            >
                <span class="font-medium text-ink">
                    {{ t(':count selected', { count: selection.count }) }}
                </span>
                <Button
                    v-if="selection.intent === 'print'"
                    variant="primary"
                    size="md"
                    @click="startPrintFlow"
                >
                    {{ t('Choose product') }}
                </Button>
                <Button
                    v-else
                    variant="primary"
                    size="md"
                    @click="emit('addToCircle')"
                >
                    {{ t('Add to circle') }}
                </Button>
            </div>
        </Transition>
    </Teleport>
</template>
