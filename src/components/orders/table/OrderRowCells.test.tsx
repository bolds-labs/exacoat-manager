// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionsCell, CourierCell, CustomerCell, ItemsCell, OrderIdCell, formatDestination } from './OrderRowCells';

afterEach(cleanup);

const base = {
  id: 101,
  order_number: '101',
  status: 'processing',
  total: 100000,
  currency: 'IDR',
  created_at: '2026-11-13T10:00:00',
  customer_name: 'Yenny',
  shipping: { city: 'Jakarta Utara', state: 'JK', country: 'ID' },
  items: [{ name: '[EXACOAT] iPhone 15 Pro Skins', quantity: 1 }],
  item_count: 1,
  meta_data: [] as any[],
} as any;

const pickup = { ...base, id: 102, meta_data: [{ key: '_is_store_pickup', value: 'yes' }] };

describe('CustomerCell', () => {
  it('shows city and province for a courier order', () => {
    render(<CustomerCell order={base} />);
    expect(screen.getByText('Jakarta Utara, DKI Jakarta')).toBeTruthy();
  });
  it('shows plain Store Pickup for a pickup order', () => {
    render(<CustomerCell order={pickup} />);
    expect(screen.getByText('Store Pickup')).toBeTruthy();
    expect(screen.queryByText(/Jakarta/)).toBeNull();
  });
  it('falls back to the country name outside Indonesia', () => {
    expect(formatDestination({ shipping: { city: 'Chatillon', state: '', country: 'FR' } } as any)).toBe('Chatillon, France');
  });
});

describe('ItemsCell', () => {
  it('keeps a second line when the order has no items', () => {
    render(<ItemsCell order={{ ...base, items: [], item_count: 0 }} />);
    expect(screen.getByText('No items')).toBeTruthy();
  });
  it('shows the item count and the cleaned product name with its quantity', () => {
    render(<ItemsCell order={base} />);
    expect(screen.getByText('1 item')).toBeTruthy();
    expect(screen.getByText('1x iPhone 15 Pro Skins')).toBeTruthy();
  });
  it('keeps per-line quantities and counts lines like the old row', () => {
    const order = {
      ...base,
      item_count: undefined,
      items: [
        { name: 'Galaxy Z Fold 7 Skins', quantity: 2 },
        { name: '[EXACOAT] Camera Skin', quantity: 1 },
      ],
    };
    render(<ItemsCell order={order} />);
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.getByText('2x Galaxy Z Fold 7 Skins, 1x Camera Skin')).toBeTruthy();
  });
});

describe('CourierCell', () => {
  it('shows Resi not assigned yet when there is no tracking number', () => {
    render(<CourierCell order={base} />);
    expect(screen.getByText('Resi not assigned yet')).toBeTruthy();
  });
  it('shows the resi with a copy button that reports the number', () => {
    const onCopy = vi.fn();
    render(<CourierCell order={{ ...base, tracking: { tracking_number: '0703622100000421' } }} onCopy={onCopy} />);
    expect(screen.getByText('0703622100000421')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy resi' }));
    expect(onCopy).toHaveBeenCalledWith('0703622100000421', expect.anything());
  });
  it('shows the store pickup location instead of a courier for pickup orders', () => {
    render(<CourierCell order={pickup} />);
    expect(screen.getByText('Store pickup')).toBeTruthy();
    expect(screen.getByText('Summarecon Bekasi')).toBeTruthy();
    expect(screen.queryByText('Resi not assigned yet')).toBeNull();
  });
});

describe('ActionsCell', () => {
  it('shows the printer only when the label is not printed', () => {
    const { rerender } = render(<ActionsCell order={base} showPrint onPrint={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: /Print 4x6 label/ })).toBeTruthy();
    rerender(<ActionsCell order={base} showPrint={false} onPrint={() => {}} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: /Print 4x6 label/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open order' })).toBeTruthy();
  });
  it('shows the review shield only when a claim needs review', () => {
    const claim = { ...base, status: 'pending', rma: { order_type: 'Warranty', status: 'pending_review' } };
    const { rerender } = render(<ActionsCell order={claim} showPrint={false} onPrint={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: 'Review claim proof' })).toBeTruthy();
    rerender(<ActionsCell order={{ ...claim, rma: { order_type: 'Warranty', status: 'approved' } }} showPrint={false} onPrint={() => {}} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Review claim proof' })).toBeNull();
  });
});

describe('OrderIdCell', () => {
  it('shows the warranty chip with the claim state under the order ID', () => {
    render(<OrderIdCell order={{ ...base, rma: { order_type: 'Warranty', status: 'approved' } }} />);
    expect(screen.getByText('#101')).toBeTruthy();
    expect(screen.getByText('Warranty')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
  });
  it('shows a redeem claim chip with the review state for redeem orders', () => {
    render(<OrderIdCell order={{ ...base, status: 'pending', rma: { order_type: 'Redeem', status: 'approved' } }} />);
    expect(screen.getByText('Redeem')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.queryByText('Warranty')).toBeNull();
  });
  it('shows Redeem claimed, not a review chip, on the original redeemed order', () => {
    render(<OrderIdCell order={{ ...base, rma: { order_type: 'Redeem', is_parent_order: true } }} />);
    expect(screen.getByText('Redeem claimed')).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
  });
  it('shows no warranty chip for a normal order', () => {
    render(<OrderIdCell order={base} />);
    expect(screen.queryByText('Warranty')).toBeNull();
  });
});
