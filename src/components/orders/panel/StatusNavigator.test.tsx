// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StatusNavigator } from './StatusNavigator';

afterEach(cleanup);

const pickupMeta = [{ key: '_is_store_pickup', value: 'yes' }];

function prevButton() {
  return screen.getByRole('button', { name: /^Previous/ }) as HTMLButtonElement;
}
function nextButton() {
  return screen.getByRole('button', { name: /^Next step/ }) as HTMLButtonElement;
}

describe('StatusNavigator', () => {
  it('shows previous, current and next steps for a processing order', () => {
    render(<StatusNavigator order={{ status: 'processing' } as any} onChangeStatus={() => {}} />);
    expect(prevButton().textContent).toContain('Waiting for Payment');
    expect(screen.getByTestId('status-current').textContent).toContain('Payment confirmed');
    expect(screen.getByText('Step 2 of 6')).toBeTruthy();
    expect(nextButton().textContent).toContain('Preparing order');
  });

  it('moves to the next step on click', () => {
    const onChangeStatus = vi.fn();
    render(<StatusNavigator order={{ status: 'processing' } as any} onChangeStatus={onChangeStatus} />);
    fireEvent.click(nextButton());
    expect(onChangeStatus).toHaveBeenCalledWith('preparing-order');
  });

  it('moves to the previous step on click', () => {
    const onChangeStatus = vi.fn();
    render(<StatusNavigator order={{ status: 'processing' } as any} onChangeStatus={onChangeStatus} />);
    fireEvent.click(prevButton());
    expect(onChangeStatus).toHaveBeenCalledWith('on-hold');
  });

  it('disables previous on step 1', () => {
    render(<StatusNavigator order={{ status: 'on-hold' } as any} onChangeStatus={() => {}} />);
    expect(prevButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(false);
    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
  });

  it('disables next on Completed', () => {
    render(<StatusNavigator order={{ status: 'completed' } as any} onChangeStatus={() => {}} />);
    expect(nextButton().disabled).toBe(true);
    expect(prevButton().disabled).toBe(false);
    expect(screen.getByText('Step 6 of 6')).toBeTruthy();
  });

  it('handles a cancelled order outside the flow', () => {
    const onChangeStatus = vi.fn();
    render(<StatusNavigator order={{ status: 'cancelled' } as any} onChangeStatus={onChangeStatus} />);
    expect(prevButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByTestId('status-current').textContent).toContain('Cancelled');
    expect(screen.queryByText(/Step \d of/)).toBeNull();
    expect(screen.getByTestId('status-track').querySelectorAll('[data-state="current"]')).toHaveLength(0);

    fireEvent.pointerDown(screen.getByRole('button', { name: /All steps/ }), { button: 0, ctrlKey: false });
    for (const label of ['Waiting for Payment', 'Payment confirmed', 'Preparing order', 'Waiting for Courier Pickup', 'Shipped', 'Completed']) {
      expect(screen.getByRole('menuitem', { name: label })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('menuitem', { name: 'Shipped' }));
    expect(onChangeStatus).toHaveBeenCalledWith('shipped');
  });

  it('shows Step 4 of 5 for a pickup order in smb-ready', () => {
    render(<StatusNavigator order={{ status: 'smb-ready', meta_data: pickupMeta } as any} onChangeStatus={() => {}} />);
    expect(screen.getByText('Step 4 of 5')).toBeTruthy();
    expect(screen.getByTestId('status-current').textContent).toContain('SMB Ready (Store Pickup)');
    expect(nextButton().textContent).toContain('Completed');
  });

  it('disables every control while disabled', () => {
    render(<StatusNavigator order={{ status: 'processing' } as any} onChangeStatus={() => {}} disabled />);
    expect(prevButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(true);
    expect((screen.getByRole('button', { name: /All steps/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets a delivered courier order be set to completed from All steps', () => {
    const onChangeStatus = vi.fn();
    render(<StatusNavigator order={{ status: 'delivered' } as any} onChangeStatus={onChangeStatus} />);
    expect(screen.getByTestId('status-current').textContent).toContain('Delivered');
    expect(screen.getByText('Step 6 of 6 (Completed)')).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole('button', { name: /All steps/ }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole('menuitem', { name: /^Completed/ }));
    expect(onChangeStatus).toHaveBeenCalledWith('completed');
  });

  it('re-sends the current status when the current step is chosen', () => {
    const onChangeStatus = vi.fn();
    render(<StatusNavigator order={{ status: 'processing' } as any} onChangeStatus={onChangeStatus} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /All steps/ }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole('menuitem', { name: /^Payment confirmed/ }));
    expect(onChangeStatus).toHaveBeenCalledWith('processing');
  });

  it('sets aria-busy while a status update runs', () => {
    const { container, rerender } = render(
      <StatusNavigator order={{ status: 'processing' } as any} onChangeStatus={() => {}} busy disabled />,
    );
    expect((container.firstChild as HTMLElement).getAttribute('aria-busy')).toBe('true');
    rerender(<StatusNavigator order={{ status: 'processing' } as any} onChangeStatus={() => {}} />);
    expect((container.firstChild as HTMLElement).getAttribute('aria-busy')).toBeNull();
  });
});
