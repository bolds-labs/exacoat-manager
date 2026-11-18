// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getOrderCourierDisplay, resolveOrderCourier } from '../../../lib/orderUtils';
import { AdminActionsCard } from './AdminActionsCard';
import { CouponsCard } from './CouponsCard';
import { addressLines, cleanCustomerNote, CustomerDeliveryCard } from './CustomerDeliveryCard';
import { ItemsCard } from './ItemsCard';
import { ShippingCard, type ShippingCardProps } from './ShippingCard';
import { ActivityCard, filterNotes, noteAuthor, noteRoleBadge } from './ActivityCard';
import { paymentState, SummaryCard } from './SummaryCard';
import { RefundCard, shouldShowRefundCard } from './RefundCard';
import { ReviewCard } from './ReviewCard';
import { emailTemplateOptions } from './ResendEmailCard';

afterEach(cleanup);
const noop = () => {};

const baseOrder = {
  id: 542887,
  order_number: '542887',
  status: 'processing',
  currency: 'IDR',
  total: 150000,
  total_tax: 0,
  subtotal: 140000,
  shipping_total: 10000,
  customer_name: 'Ayu',
  customer_email: 'ayu@example.com',
  meta_data: [],
} as any;

describe('AdminActionsCard', () => {
  it('renders nothing for non-admins (shop managers)', () => {
    const { container } = render(
      <AdminActionsCard isAdmin={false} isCancelled={false} isCancelling={false} isTrashing={false} onCancel={noop} onTrash={noop} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows cancel and trash for admins and disables cancel on cancelled orders', () => {
    const onTrash = vi.fn();
    render(<AdminActionsCard isAdmin isCancelled isCancelling={false} isTrashing={false} onCancel={noop} onTrash={onTrash} />);
    expect(screen.getByText('Admin only')).toBeTruthy();
    expect((screen.getByRole('button', { name: /order cancelled/i }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /move to trash/i }));
    expect(onTrash).toHaveBeenCalled();
  });
});

describe('CouponsCard', () => {
  it('always renders, with an empty state', () => {
    render(<CouponsCard order={baseOrder} shippingDiscount={0} shippingPromoCode="" />);
    expect(screen.getByText('Coupons & adjustments')).toBeTruthy();
    expect(screen.getByText('No coupons or adjustments')).toBeTruthy();
  });

  it('tags the shipping coupon', () => {
    render(<CouponsCard order={{ ...baseOrder, coupon_codes: ['ONGKIR50'] }} shippingDiscount={10000} shippingPromoCode="" />);
    expect(screen.getByText('ONGKIR50')).toBeTruthy();
    expect(screen.getByText('Shipping promo')).toBeTruthy();
  });
});

describe('CustomerDeliveryCard', () => {
  const props = {
    isSwitchingFulfillment: false,
    isStoreAddress: false,
    copiedField: null,
    canOpenCustomer: true,
    onToggleStorePickup: noop,
    onEditAddress: noop,
    onCopy: noop,
    onWhatsApp: noop,
    onOpenCustomer: noop,
  };

  it('shows empty states when address, phone and email are missing', () => {
    render(<CustomerDeliveryCard {...props} order={{ ...baseOrder, customer_email: '' }} isStorePickup={false} />);
    expect(screen.getByText('No shipping address on this order')).toBeTruthy();
    expect(screen.getByText('No email')).toBeTruthy();
    expect(screen.getByText('No phone')).toBeTruthy();
    expect(screen.getByRole('switch', { name: /store pickup/i })).toBeTruthy();
  });

  it('shows Switch to courier on pickup orders and hides the profile link for shop managers', () => {
    const onToggle = vi.fn();
    render(
      <CustomerDeliveryCard {...props} canOpenCustomer={false} onToggleStorePickup={onToggle} order={baseOrder} isStorePickup />,
    );
    expect(screen.queryByText('Customer profile')).toBeNull();
    expect(screen.getByText('Store pickup location')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /switch to courier/i }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('builds address lines and skips empty parts', () => {
    expect(addressLines({ ...baseOrder, shipping: { address_1: 'Jl. A 1', city: 'Bekasi', postcode: '17142', country: '' } })).toEqual([
      'Jl. A 1',
      'Bekasi 17142',
    ]);
    expect(addressLines(baseOrder)).toEqual([]);
  });

  it('strips courier hint lines from the customer note', () => {
    expect(cleanCustomerNote('Shipping courier: JNE REG\nPlease wrap')).toBe('Please wrap');
    expect(cleanCustomerNote('Courier: SiCepat')).toBe('');
  });
});

describe('ItemsCard', () => {
  it('shows an empty state with no items', () => {
    render(
      <ItemsCard
        order={baseOrder}
        items={[]}
        linkedClaims={[]}
        onAddItem={noop}
        onEditItem={noop}
        onPreviewCustom={noop}
        onReviewClaim={noop}
      />,
    );
    expect(screen.getByText('No items on this order')).toBeTruthy();
    expect(screen.getByText('Total units 0')).toBeTruthy();
  });

  it('opens the linked warranty claim review', () => {
    const onReviewClaim = vi.fn();
    render(
      <ItemsCard
        order={baseOrder}
        items={[{ id: 1, product_id: 540705, name: 'Xiaomi 17 Skins', quantity: 2, subtotal: 1, total: 1 } as any]}
        linkedClaims={[{ kind: 'warranty', orderId: 542888, reference: 'W-1', status: 'pending_review' }]}
        onAddItem={noop}
        onEditItem={noop}
        onPreviewCustom={noop}
        onReviewClaim={onReviewClaim}
      />,
    );
    expect(screen.getByText('Pending review')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /review claim proof/i }));
    expect(onReviewClaim).toHaveBeenCalledWith(542888);
    expect(screen.getByText('Total units 2')).toBeTruthy();
  });
});

describe('ShippingCard', () => {
  it('resolves a saved JNE service before the original checkout shipping method', () => {
    const order = {
      tracking: { carrier_id: 'jne', courier: 'JNE - REG', tracking_number: '0703632100098334' },
      shipping_lines: [{ method_title: 'JNE - REG' }],
      jne_service: 'YES',
    };
    expect(resolveOrderCourier(order)).toMatchObject({ courierId: 'jne', serviceName: 'YES' });
    expect(getOrderCourierDisplay(order)).toBe('JNE - YES');
  });

  const props: ShippingCardProps = {
    order: baseOrder,
    isStorePickup: false,
    isPrinted: false,
    courier: 'jne',
    courierOptions: [{ value: 'jne', label: 'JNE Express' }],
    jneService: 'REG',
    onJneServiceChange: vi.fn(),
    onSaveShipping: vi.fn(),
    customCourierName: '',
    customTrackingUrl: '',
    trackingNumber: '',
    onCourierChange: noop,
    onCustomCourierNameChange: noop,
    onCustomTrackingUrlChange: noop,
    onTrackingNumberChange: noop,
    onSaveTracking: noop,
    isFulfilling: false,
    isSyncingTracking: false,
    onSyncTracking: noop,
    onOpenTracking: noop,
    showAllCheckpoints: false,
    onToggleCheckpoints: noop,
    onPrintLabel: noop,
    onBookGoorita: noop,
    onDownloadAwb: noop,
    isBookingRayspeed: false,
    onBookRayspeed: noop,
  };

  it('warns when the label is not printed and keeps Save tracking disabled without a resi', () => {
    render(<ShippingCard {...props} />);
    expect(screen.getByText('Label not printed')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save tracking' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /track order/i })).toBeNull();
  });

  it('uses the saved JNE label and saves the shipping price without a resi', async () => {
    const onSaveShipping = vi.fn().mockResolvedValue(undefined);
    const order = {
      ...baseOrder,
      shipping_method_name: 'JNE - REG',
      tracking: { carrier_id: 'jne', courier: 'JNE - YES', tracking_number: '0703632100098334' },
      shipping_lines: [{ id: 42, method_title: 'JNE Express - YES', total: '10000' }],
    };
    render(<ShippingCard {...props} order={order} onSaveShipping={onSaveShipping} />);
    expect(screen.getByRole('combobox', { name: 'JNE service' }).textContent).toContain('REG');
    fireEvent.change(screen.getByLabelText('Shipping price before tax'), { target: { value: '15000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save shipping' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save shipping' })).toBeTruthy());
    expect(onSaveShipping).toHaveBeenCalledWith({ jne_service: undefined, shipping_prices: [{ id: 42, total: '15000' }] });
  });

  it('shows the pickup notice and workshop label on pickup orders', () => {
    const onPrintLabel = vi.fn();
    render(<ShippingCard {...props} isStorePickup onPrintLabel={onPrintLabel} />);
    expect(screen.queryByText('Shipping & tracking')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /workshop label/i }));
    expect(onPrintLabel).toHaveBeenCalled();
  });
});

describe('ActivityCard', () => {
  const notes = [
    { id: 1, content: 'Packed', date_created: '2026-11-13T10:00:00' },
    { id: 2, content: 'Thanks!', date_created: '2026-11-13T11:00:00', customer_note: true },
  ] as any;

  it('filters customer notes', () => {
    expect(filterNotes(notes, 'customer').map((n) => n.id)).toEqual([2]);
    expect(filterNotes(notes, 'all')).toHaveLength(2);
    render(
      <ActivityCard
        notes={notes}
        isLoading={false}
        newNote=""
        onNewNoteChange={noop}
        isCustomerNote={false}
        onCustomerNoteChange={noop}
        isAdding={false}
        onAddNote={noop}
        renderContent={(c) => c}
      />,
    );
    expect(screen.getByText('Packed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Customer notes' }));
    expect(screen.queryByText('Packed')).toBeNull();
    expect(screen.getByText('Thanks!')).toBeTruthy();
  });

  it('opens the composer from Add note', () => {
    render(
      <ActivityCard
        notes={[]}
        isLoading={false}
        newNote=""
        onNewNoteChange={noop}
        isCustomerNote={false}
        onCustomerNoteChange={noop}
        isAdding={false}
        onAddNote={noop}
        renderContent={(c) => c}
      />,
    );
    expect(screen.getByText('No order notes yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByLabelText('Note')).toBeTruthy();
  });
});

describe('SummaryCard', () => {
  it('derives the payment state like the previous panel', () => {
    expect(paymentState({ ...baseOrder, date_paid: '2026-11-13T10:00:00', payment_method_title: 'PayPal' }, 'processing').kind).toBe('paid');
    expect(paymentState(baseOrder, 'processing').text).toContain('Confirmed');
    expect(paymentState({ ...baseOrder, status: 'pending' }, 'pending').kind).toBe('pending');
  });

  it('shows Refund only when something is refundable and the unique payment code when present', () => {
    const onRefund = vi.fn();
    const { rerender } = render(
      <SummaryCard
        order={{ ...baseOrder, meta_data: [{ key: '_bca_unique_code', value: '36' }] }}
        currentStatus="processing"
        shippingDiscount={0}
        originalShippingRate={10000}
        shippingPromoCode=""
        remainingAvailableRefund={150000}
        onRefund={onRefund}
      />,
    );
    expect(screen.getByText('Unique payment code')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /refund/i }));
    expect(onRefund).toHaveBeenCalled();
    rerender(
      <SummaryCard
        order={baseOrder}
        currentStatus="processing"
        shippingDiscount={0}
        originalShippingRate={10000}
        shippingPromoCode=""
        remainingAvailableRefund={0}
        onRefund={onRefund}
      />,
    );
    expect(screen.queryByRole('button', { name: /refund/i })).toBeNull();
  });
});

describe('RefundCard', () => {
  it('shows only with refunds or a guarantee claim', () => {
    expect(shouldShowRefundCard(0, null)).toBe(false);
    expect(shouldShowRefundCard(10, null)).toBe(true);
  });

  it('offers the guarantee actions for a pending return', () => {
    const onAction = vi.fn();
    render(
      <RefundCard
        order={baseOrder}
        totalRefunded={0}
        netSettledTotal={150000}
        guarantee={{ has_claim: true, status: 'pending_return', refund_method: 'store_credit', refund_amount: 150000, destination: '' }}
        isProcessingGuarantee={false}
        onGuaranteeAction={onAction}
        onRejectGuarantee={noop}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /mark package received/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve & issue refund/i }));
    expect(onAction.mock.calls).toEqual([['mark_received'], ['approve_refund']]);
    expect(screen.getByRole('button', { name: /reject/i })).toBeTruthy();
  });
});

describe('ReviewCard', () => {
  it('shows Pre-delivery and the automatic invite note before delivery', () => {
    render(<ReviewCard order={baseOrder} review={null} isSendingInvite={false} onSendInvite={noop} onPreviewMedia={noop} />);
    expect(screen.getByText('Pre-delivery')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /invitation/i })).toBeNull();
  });

  it('offers the invite on completed orders', () => {
    const onSend = vi.fn();
    render(
      <ReviewCard order={{ ...baseOrder, status: 'completed' }} review={null} isSendingInvite={false} onSendInvite={onSend} onPreviewMedia={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /send review invitation/i }));
    expect(onSend).toHaveBeenCalled();
  });
});

describe('Resend email templates', () => {
  it('adds the store pickup template on pickup orders only', () => {
    expect(emailTemplateOptions(false).map((o) => o.value)).not.toContain('customer_order_store_pickup_ready');
    expect(emailTemplateOptions(true).map((o) => o.value)).toContain('customer_order_store_pickup_ready');
    expect(emailTemplateOptions(false)).toHaveLength(7);
  });
});

describe('note author line', () => {
  it('shows System once, without a duplicate System badge', () => {
    const note = { id: 1, content: 'Order status changed', author_name: 'System', author_role: 'System' } as any;
    expect(noteAuthor(note)).toBe('System');
    expect(noteRoleBadge(note)).toBeNull();
  });

  it('shows the staff name with their role', () => {
    const note = { id: 2, content: 'x', author_name: 'Shandy', author_role: 'Administrator' } as any;
    expect(noteAuthor(note)).toBe('Shandy');
    expect(noteRoleBadge(note)).toBe('Administrator');
  });

  it('falls back to System when no author is recorded', () => {
    expect(noteAuthor({ id: 3, content: 'x' } as any)).toBe('System');
  });
});
