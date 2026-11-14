// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const bridge = vi.hoisted(() => ({ duplicateProductDirect: vi.fn() }));
vi.mock('../../lib/wordpressBridge', async (orig) => ({ ...(await orig<object>()), ...bridge }));
vi.mock('../ds/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DuplicateProductModal } from './DuplicateProductModal';

const source = { id: 9, name: 'iPhone 17 Pro Skins', slug: 'iphone-17-pro-skins', price: 129000, categoryName: 'iPhone' };

beforeEach(() => {
  bridge.duplicateProductDirect.mockReset();
  bridge.duplicateProductDirect.mockResolvedValue({ success: true, productId: 10, name: 'Copy' });
});
afterEach(cleanup);

describe('DuplicateProductModal', () => {
  it('in Studio has no price field and keeps the source regular price', async () => {
    render(<DuplicateProductModal source={source} allowPrice={false} onClose={() => {}} onDuplicated={() => {}} />);
    expect(screen.queryByLabelText('Regular price (Rp)')).toBeNull();
    expect(screen.getByText(/keeps the source's regular price/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(bridge.duplicateProductDirect).toHaveBeenCalled());
    expect(bridge.duplicateProductDirect.mock.calls[0][0]).toMatchObject({ source_product_id: 9, new_price: 129000 });
  });

  it('in Products lets staff set the price of the copy', async () => {
    render(<DuplicateProductModal source={source} offerAutoSeo onClose={() => {}} onDuplicated={() => {}} />);
    fireEvent.change(screen.getByLabelText('Regular price (Rp)'), { target: { value: '139.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(bridge.duplicateProductDirect).toHaveBeenCalled());
    expect(bridge.duplicateProductDirect.mock.calls[0][0]).toMatchObject({ new_price: 139000, auto_generate_seo: true });
  });
});
