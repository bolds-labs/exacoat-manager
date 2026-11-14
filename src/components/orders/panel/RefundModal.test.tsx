// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { amountAfterMethodSwitch, RefundModal, type RefundModalProps } from './RefundModal';

afterEach(cleanup);

describe('amountAfterMethodSwitch', () => {
  it('moves the full amount to the subsidized net when switching to store credit', () => {
    expect(amountAfterMethodSwitch('store_credit', '150000', 150000, 20000)).toBe('130000');
  });
  it('restores the full amount when switching back to the original payment', () => {
    expect(amountAfterMethodSwitch('original', '130000', 150000, 20000)).toBe('150000');
  });
  it('keeps a hand-typed amount', () => {
    expect(amountAfterMethodSwitch('store_credit', '50000', 150000, 20000)).toBe('50000');
    expect(amountAfterMethodSwitch('original', '50000', 150000, 20000)).toBe('50000');
  });
  it('never changes the amount without a shipping subsidy', () => {
    expect(amountAfterMethodSwitch('store_credit', '150000', 150000, 0)).toBe('150000');
  });
});

const order = {
  id: 542887,
  status: 'processing',
  currency: 'IDR',
  total: 150000,
  customer_id: 7,
  customer_store_credit_balance: 10000,
  payment_method_title: 'BCA Virtual Account',
} as any;

function setup(over: Partial<RefundModalProps> = {}) {
  const props: RefundModalProps = {
    open: true,
    onOpenChange: vi.fn(),
    order,
    orderRef: '#542887',
    totalRefunded: 0,
    remainingAvailableRefund: 150000,
    shippingDiscount: 20000,
    amount: '150000',
    onAmountChange: vi.fn(),
    reason: '',
    onReasonChange: vi.fn(),
    method: 'original',
    onMethodChange: vi.fn(),
    restock: true,
    onRestockChange: vi.fn(),
    markAsRefunded: false,
    onMarkAsRefundedChange: vi.fn(),
    isProcessing: false,
    onSubmit: vi.fn((e) => e.preventDefault()),
    ...over,
  };
  render(<RefundModal {...props} />);
  return props;
}

describe('RefundModal', () => {
  it('shows the summary, both destinations and a primary action with the amount', () => {
    setup();
    expect(screen.getByText('Issue refund')).toBeTruthy();
    expect(screen.getByText('#542887')).toBeTruthy();
    expect(screen.getByText('Order total')).toBeTruthy();
    expect(screen.getByText('Already refunded')).toBeTruthy();
    expect(screen.getByText('Available to refund')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Original payment/ })).toBeTruthy();
    expect(screen.getByText('Back to BCA Virtual Account')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Store credit/ })).toBeTruthy();
    expect(screen.getByText('A full refund marks the order as Refunded.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Refund Rp\s?150\.000$/ })).toBeTruthy();
  });

  it('switches to store credit with the subsidized amount and shows the subsidy lines', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('radio', { name: /Store credit/ }));
    expect(p.onMethodChange).toHaveBeenCalledWith('store_credit');
    expect(p.onAmountChange).toHaveBeenCalledWith('130000');
  });

  it('shows the shipping subsidy deduction, suggested net refund and 1-click apply for store credit', () => {
    const p = setup({ method: 'store_credit', amount: '150000' });
    expect(screen.getByText('Shipping subsidy deduction')).toBeTruthy();
    expect(screen.getByText('Suggested net refund')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Apply subsidized net/ }));
    expect(p.onAmountChange).toHaveBeenCalledWith('130000');
  });

  it('disables store credit for guest orders', () => {
    setup({ order: { ...order, customer_id: 0 } });
    expect((screen.getByRole('radio', { name: /Store credit/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Guest order (no account)')).toBeTruthy();
  });

  it('offers the Refunded status checkbox for partial refunds', () => {
    const p = setup({ amount: '50000' });
    fireEvent.click(screen.getByLabelText(/Update status to Refunded/));
    expect(p.onMarkAsRefundedChange).toHaveBeenCalledWith(true);
  });

  it('disables the action for an amount above the remaining balance and submits the form otherwise', () => {
    setup({ amount: '999999' });
    expect((screen.getByRole('button', { name: /^Refund/ }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Refund Rp/ }));
    expect(p.onSubmit).toHaveBeenCalled();
  });

  it('wires restock and reason', () => {
    const p = setup();
    fireEvent.click(screen.getByLabelText('Restock items'));
    expect(p.onRestockChange).toHaveBeenCalledWith(false);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Customer request' } });
    expect(p.onReasonChange).toHaveBeenCalledWith('Customer request');
  });
});
