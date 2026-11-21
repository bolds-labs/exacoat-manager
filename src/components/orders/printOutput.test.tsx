// @vitest-environment jsdom
/**
 * Guards the printed documents (owner instruction): the HTML each print button writes into the
 * print window, and the on-screen print preview, must not change when the surrounding modal
 * chrome changes. Snapshots were recorded on the pre-redesign chrome.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { PackingSlipModal } from './PackingSlipModal';
import { CustomerInvoiceModal } from './CustomerInvoiceModal';
import { ShippingLabelA6Modal } from './ShippingLabelA6Modal';

const order = {
  id: 542887,
  order_number: '542887',
  status: 'processing',
  currency: 'IDR',
  total: 185000,
  subtotal: 170000,
  total_tax: 0,
  shipping_total: 15000,
  discount_total: 0,
  created_at: '2026-11-10T08:30:00',
  date_paid: '2026-11-10T08:35:00',
  payment_method_title: 'BCA Virtual Account',
  customer_name: 'Ayu Lestari',
  customer_email: 'ayu@example.com',
  customer_phone: '081234567890',
  customer_note: 'Please pack carefully',
  billing: { first_name: 'Ayu', last_name: 'Lestari', email: 'ayu@example.com', phone: '081234567890', address_1: 'Jl. Melati No. 5', city: 'Bandung', state: 'Jawa Barat', postcode: '40115', country: 'ID' },
  shipping: { first_name: 'Ayu', last_name: 'Lestari', phone: '081234567890', address_1: 'Jl. Melati No. 5', address_2: 'RT 02 RW 03', city: 'Bandung', state: 'Jawa Barat', postcode: '40115', country: 'ID' },
  shipping_lines: [{ id: 1, method_title: 'JNE - REG', method_id: 'biteship', total: '15000', meta_data: [] }],
  tracking: { carrier_id: 'jne', courier: 'JNE - REG', tracking_number: '012345678901234', tracking_url: '', latest_status: 'processing' },
  items: [
    { id: 11, name: '[EXACOAT] iPhone 16 Pro Skins', quantity: 1, price: 140000, total: '140000', sku: 'IP16P', product_id: 100, meta_data: [{ key: 'Back Skin', value: 'Swarm' }, { key: 'Camera', value: 'Matte Black' }] },
    { id: 12, name: 'Galaxy S25 Skins', quantity: 2, price: 15000, total: '30000', product_id: 200, meta_data: [{ key: 'Back Skin', value: 'Black Camo' }] },
  ],
  meta_data: [],
} as any;

let written: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T10:00:00'));
  written = [];
  vi.spyOn(window, 'open').mockImplementation(
    () => ({ document: { write: (h: string) => written.push(h), close: () => {} }, focus: () => {}, print: () => {} }) as any,
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const printButton = (name: RegExp) => { const all = screen.getAllByRole("button", { name }); return all[all.length - 1]; };

describe('printed documents stay byte-identical', () => {
  it('packing slip', () => {
    render(<PackingSlipModal order={order} isOpen onClose={() => {}} />);
    const preview = document.querySelector('[style*="Inter"]') as HTMLElement;
    expect(preview.outerHTML).toMatchSnapshot('preview');
    fireEvent.click(printButton(/print packing slip/i));
    expect(written.join('')).toMatchSnapshot('print window');
  });

  it('customer invoice', () => {
    render(<CustomerInvoiceModal order={order} isOpen onClose={() => {}} />);
    const preview = document.querySelector('[style*="Inter"]') as HTMLElement;
    expect(preview.outerHTML).toMatchSnapshot('preview');
    fireEvent.click(printButton(/print invoice/i));
    expect(written.join('')).toMatchSnapshot('print window');
  });

  it('shipping label', () => {
    const labelOrder = { ...order, item_count: order.items.length };
    render(<ShippingLabelA6Modal order={labelOrder} orders={[labelOrder]} isOpen onClose={() => {}} />);
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcdoc')).toMatchSnapshot('preview');
    fireEvent.click(printButton(/print 4.6 label/i));
    expect(written.join('')).toMatchSnapshot('print window');
  });
});
