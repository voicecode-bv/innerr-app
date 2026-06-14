import { createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';

const apiGet = vi.fn();

vi.mock('@/spa/http/externalApi', () => ({
    externalApi: {
        get: (path: string) => apiGet(path),
    },
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn() }),
    RouterLink: { template: '<a><slot /></a>' },
}));

const PrintOrders = (await import('./PrintOrders.vue')).default;

function mountPage() {
    const app = createApp(PrintOrders);
    app.use(createPinia());

    const host = document.createElement('div');
    document.body.appendChild(host);
    app.mount(host);

    return {
        host,
        unmount: () => {
            app.unmount();
            host.remove();
        },
    };
}

beforeEach(() => {
    document.body.innerHTML = '';
    apiGet.mockReset();
});

describe('PrintOrders page', () => {
    it('mounts and renders the loaded orders', async () => {
        apiGet.mockResolvedValue({
            data: [
                {
                    id: 'order-1',
                    number: 1042,
                    amount_minor: 4490,
                    currency: 'EUR',
                    status: 'submitted',
                    printdeal_order_number: '202612345',
                    printdeal_status: 'InProduction',
                    created_at: '2026-06-12T10:00:00Z',
                    items: [
                        {
                            id: 'item-1',
                            app_product: 'puzzle',
                            name: { 'en-EN': 'Jigsaw Puzzles' },
                            options: { 'Print Area': '54 x 40 cm (500 pcs)' },
                            photo_count: 1,
                            amount_minor: 2495,
                            printdeal_status: 'InProduction',
                        },
                    ],
                },
            ],
        });

        const { host, unmount } = mountPage();
        await nextTick();
        await nextTick();

        expect(apiGet).toHaveBeenCalledWith('/print/orders');
        expect(host.textContent).toContain('1042');
        expect(host.textContent).toContain('Jigsaw Puzzles');
        expect(host.textContent).toContain('54 x 40 cm (500 pcs)');
        expect(host.textContent).toContain('202612345');

        unmount();
    });

    it('shows the empty state without orders', async () => {
        apiGet.mockResolvedValue({ data: [] });

        const { host, unmount } = mountPage();
        await nextTick();
        await nextTick();

        expect(host.textContent).toContain('No orders yet');

        unmount();
    });
});
