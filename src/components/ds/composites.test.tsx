// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Package, Trash2, Pencil } from 'lucide-react';
import { Button, Card, Drawer, KpiCard, Menu, Modal, StatusChip, Tabs, WarrantyChip } from './index';

afterEach(cleanup);

const warrantyOrder = { status: 'processing', meta_data: [{ key: '_is_warranty', value: 'yes' }] } as any;

describe('StatusChip', () => {
  it('shows To prepare with the act family token for processing', () => {
    render(<StatusChip order={{ status: 'processing' } as any} />);
    expect(screen.getByText('To prepare').className).toContain('text-st-act-fg');
  });
  it('shows Ready for pickup for a pickup order in smb-ready', () => {
    render(<StatusChip order={{ status: 'smb-ready', meta_data: [{ key: '_is_store_pickup', value: 'yes' }] } as any} />);
    expect(screen.getByText('Ready for pickup')).toBeTruthy();
  });
  it('lets order win over meta', () => {
    render(<StatusChip order={{ status: 'completed' } as any} meta={{ key: 'x', label: 'Other', family: 'stop', icon: Package }} />);
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.queryByText('Other')).toBeNull();
  });
});

describe('WarrantyChip', () => {
  it('renders Warranty and Pending for a pending warranty order', () => {
    render(<WarrantyChip order={warrantyOrder} />);
    expect(screen.getByText('Warranty')).toBeTruthy();
    expect(screen.getByText('Pending').className).toContain('text-st-act-fg');
  });
  it('renders nothing for a normal order', () => {
    const { container } = render(<WarrantyChip order={{ status: 'processing' } as any} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('Tabs', () => {
  it('marks the active tab, renders hot counts and reports changes', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="a"
        onChange={onChange}
        items={[{ key: 'a', label: 'All', count: 3 }, { key: 'b', label: 'To prepare', count: 4, hot: true }]}
      />,
    );
    expect(screen.getByRole('tab', { name: /All/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /To prepare/ }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('4').className).toContain('text-accent-fg');
    fireEvent.click(screen.getByRole('tab', { name: /To prepare/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Card and KpiCard', () => {
  it('Card renders title, count and actions', () => {
    render(<Card icon={Package} title="Items" count={2} actions={<button>Edit</button>}>body</Card>);
    expect(screen.getByText('Items')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });
  it('KpiCard tints the icon tile only when highlighted', () => {
    const { container, rerender } = render(<KpiCard icon={Package} value="12" label="Orders" />);
    expect(container.querySelector('span')!.className).not.toContain('bg-accent-soft');
    rerender(<KpiCard icon={Package} value="12" label="Orders" highlight />);
    expect(container.querySelector('span')!.className).toContain('bg-accent-soft');
  });
});

describe('Modal', () => {
  it('renders title, reference, body and footer when open and closes via the close button', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Refund" reference="#1042" footer={<Button>Confirm</Button>}>
        Body text
      </Modal>,
    );
    expect(screen.getByText('Refund')).toBeTruthy();
    expect(screen.getByText('#1042')).toBeTruthy();
    expect(screen.getByText('Body text')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it('renders nothing when closed', () => {
    render(<Modal open={false} onOpenChange={() => {}} title="Hidden">x</Modal>);
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});

describe('Drawer', () => {
  it('renders a pinned header and a scrolling body', () => {
    render(<Drawer open onOpenChange={() => {}} header={<div>Order header</div>}><div>Order body</div></Drawer>);
    expect(screen.getByText('Order header')).toBeTruthy();
    expect(screen.getByText('Order body').parentElement!.className).toContain('overflow-y-auto');
    expect(screen.getByRole('dialog').className).toContain('max-w-[calc(100vw-48px)]');
  });
});

describe('Menu', () => {
  it('opens, styles danger items with the stop token and fires onSelect', () => {
    const onSelect = vi.fn();
    render(
      <Menu
        trigger={<button>More</button>}
        items={[
          { icon: Pencil, title: 'Edit address', description: 'Change shipping', onSelect: () => {} },
          'separator',
          { icon: Trash2, title: 'Cancel order', danger: true, onSelect },
        ]}
      />,
    );
    fireEvent.pointerDown(screen.getByText('More'), { button: 0, ctrlKey: false });
    expect(screen.getByText('Edit address')).toBeTruthy();
    expect(screen.getByText('Change shipping')).toBeTruthy();
    const danger = screen.getByText('Cancel order');
    expect(danger.className).toContain('text-st-stop-fg');
    fireEvent.click(danger);
    expect(onSelect).toHaveBeenCalledOnce();
  });
  it('marks the selected item with a check', () => {
    render(
      <Menu
        trigger={<button>Pick</button>}
        items={[
          { icon: Pencil, title: 'Redeem', onSelect: () => {}, selected: true },
          { icon: Trash2, title: 'Endorsements', onSelect: () => {} },
        ]}
      />,
    );
    fireEvent.pointerDown(screen.getByText('Pick'), { button: 0, ctrlKey: false });
    expect(screen.getAllByLabelText('Selected')).toHaveLength(1);
    expect(screen.getByText('Redeem').closest('[role="menuitem"]')?.getAttribute('aria-current')).toBe('true');
  });
});

describe('token classes', () => {
  it('no composite emits an opacity suffix on a token colour', () => {
    const { container } = render(
      <>
        <Card icon={Package} title="t" count={1} actions={<span>a</span>}>b</Card>
        <KpiCard icon={Package} value="1" label="l" highlight />
        <Tabs value="a" onChange={() => {}} items={[{ key: 'a', label: 'A', count: 1, hot: true }, { key: 'b', label: 'B' }]} />
        <StatusChip order={{ status: 'processing' } as any} />
        <StatusChip order={{ status: 'weird' } as any} size="sm" />
        <WarrantyChip order={warrantyOrder} />
      </>,
    );
    const bad = /\b(accent|st-[a-z]+-(fg|bg|border)|fg|muted|faint|chip|field|line)\/\d+/;
    for (const el of Array.from(container.querySelectorAll('[class]'))) {
      const cls = el.getAttribute('class') ?? '';
      expect(cls, cls).not.toMatch(bad);
    }
  });
});
