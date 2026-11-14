// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { ClaimBanner, ClaimStatusPill, PanelHeader } from './PanelHeader';

afterEach(cleanup);

const noop = () => {};
const metaOnlyWarranty = {
  id: 542888,
  status: 'processing',
  created_at: '2026-11-13T18:32:00',
  payment_method_title: 'BCA transfer',
  meta_data: [
    { key: '_rma_order_type', value: 'Warranty' },
    { key: '_rma_status', value: 'approved' },
  ],
} as any;

function renderHeader(order: any, props: Partial<Parameters<typeof PanelHeader>[0]> = {}) {
  return render(
    <PanelHeader
      order={order}
      onClose={noop}
      onPrintLabel={noop}
      onInvoice={noop}
      onPackingSlip={noop}
      moreItems={[]}
      {...props}
    />,
  );
}

describe('PanelHeader', () => {
  it('shows the claim review state from _rma_* meta when the order has no rma object', () => {
    renderHeader(metaOnlyWarranty);
    expect(screen.getByText('Warranty')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
  });

  it('shows a redeem chip from _rma_order_type meta', () => {
    renderHeader({ ...metaOnlyWarranty, meta_data: [{ key: '_rma_order_type', value: 'Redeem' }, { key: '_rma_status', value: 'rejected' }] });
    expect(screen.getByText('Redeem')).toBeTruthy();
    expect(screen.getByText('Rejected')).toBeTruthy();
  });

  it('renders the order ID, meta line and the document actions', () => {
    const onPrintLabel = vi.fn();
    const onInvoice = vi.fn();
    const onPackingSlip = vi.fn();
    const onClose = vi.fn();
    renderHeader({ ...metaOnlyWarranty, customer_ip: '10.0.0.1' }, { onPrintLabel, onInvoice, onPackingSlip, onClose, isStorePickup: true });
    expect(screen.getByText('#542888')).toBeTruthy();
    expect(screen.getByText('BCA transfer')).toBeTruthy();
    expect(screen.getByText('IP 10.0.0.1')).toBeTruthy();
    expect(screen.getByText('Store Pickup')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Print label/ }));
    fireEvent.click(screen.getByRole('button', { name: /Invoice/ }));
    fireEvent.click(screen.getByRole('button', { name: /Packing slip/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(onPrintLabel).toHaveBeenCalledOnce();
    expect(onInvoice).toHaveBeenCalledOnce();
    expect(onPackingSlip).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /More/ })).toBeNull();
  });

  it('shows More when there are secondary actions', () => {
    const onSelect = vi.fn();
    renderHeader(metaOnlyWarranty, { moreItems: [{ icon: RotateCcw, title: 'Redeem', onSelect }] });
    fireEvent.pointerDown(screen.getByRole('button', { name: /More/ }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole('menuitem', { name: /Redeem/ }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe('ClaimBanner', () => {
  it('renders title, reference, channel, reason, status and the review action', () => {
    const onReview = vi.fn();
    render(
      <ClaimBanner
        icon={ShieldCheck}
        title="48-hour installation warranty replacement"
        reference="2611124PTMK51A"
        channel="Shopee"
        reason="wrinkled"
        status={<ClaimStatusPill status="approved" />}
        onReview={onReview}
      />,
    );
    expect(screen.getByText('#2611124PTMK51A')).toBeTruthy();
    expect(screen.getByText(/on Shopee/)).toBeTruthy();
    expect(screen.getByText(/Reason: wrinkled/)).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Review claim proof/ }));
    expect(onReview).toHaveBeenCalledOnce();
  });

  it('shows Pending review for an unreviewed claim', () => {
    render(<ClaimStatusPill status="pending_review" />);
    expect(screen.getByText('Pending review')).toBeTruthy();
  });
});
