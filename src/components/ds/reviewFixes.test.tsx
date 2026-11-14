// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Wallet, Undo2, Landmark } from 'lucide-react';
import { Drawer } from './Drawer';
import { SearchField } from './SearchField';
import { TextField } from './TextField';
import { Select } from './Select';
import { RadioCardGroup } from './RadioCard';
import { Switch } from './Switch';
import { Tabs } from './Tabs';
import { Button } from './Button';
import { Modal as LegacyModal } from '../ui/Modal';
import { PageHeroHeader } from '../ui/PageHeroHeader';

afterEach(cleanup);

function zOf(el: Element | null): number {
  let node: Element | null = el;
  while (node) {
    const m = (node.getAttribute('class') ?? '').match(/(?:^|\s)z-\[(\d+)\]/);
    if (m) return Number(m[1]);
    node = node.parentElement;
  }
  return 0;
}

describe('Drawer layering with legacy modals', () => {
  it('is non-modal so a legacy modal opened inside stays on top, clickable and not aria-hidden', () => {
    const onConfirm = vi.fn();
    render(
      <Drawer open onOpenChange={() => {}} header={<div>Order header</div>}>
        <LegacyModal isOpen onClose={() => {}} title="Edit address">
          <button onClick={onConfirm}>Save address</button>
        </LegacyModal>
      </Drawer>,
    );
    const drawer = screen.getByText('Order header').closest('[role="dialog"]');
    const legacy = screen.getByRole('dialog', { name: 'Edit address' });
    expect(zOf(legacy)).toBeGreaterThan(zOf(drawer));
    expect(zOf(legacy)).toBe(220);
    expect(legacy.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.querySelector('body > [aria-hidden="true"]:not([data-drawer-scrim])')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe('none');
    fireEvent.click(screen.getByText('Save address'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
  it('keeps a caller-provided legacy modal zIndex', () => {
    render(<LegacyModal isOpen onClose={() => {}} title="Custom" zIndex="z-[999]">x</LegacyModal>);
    expect(zOf(screen.getByRole('dialog', { name: 'Custom' }))).toBe(999);
  });
  it('closes on scrim click and on Escape', () => {
    const onOpenChange = vi.fn();
    render(<Drawer open onOpenChange={onOpenChange} header={<div>H</div>}>B</Drawer>);
    fireEvent.click(document.querySelector('[data-drawer-scrim]')!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    fireEvent.keyDown(screen.getByText('B'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it('does not close when clicking inside a legacy modal portaled outside it', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer open onOpenChange={onOpenChange} header={<div>H</div>}>
        <LegacyModal isOpen onClose={() => {}} title="Inner"><button>Inner action</button></LegacyModal>
      </Drawer>,
    );
    const btn = screen.getByText('Inner action');
    fireEvent.pointerDown(btn);
    fireEvent.mouseDown(btn);
    fireEvent.click(btn);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('kit native controls opt out of legacy light-mode form overrides', () => {
  it('marks native inputs and selects with data-ds', () => {
    render(
      <>
        <TextField label="Name" />
        <SearchField placeholder="Search orders" />
        <Select label="Courier" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} />
      </>,
    );
    expect(screen.getByLabelText('Name').hasAttribute('data-ds')).toBe(true);
    expect(screen.getByLabelText('Search orders').hasAttribute('data-ds')).toBe(true);
    expect(screen.getByLabelText('Courier').hasAttribute('data-ds')).toBe(true);
  });
  it('legacy light-mode input, select and textarea rules skip [data-ds]', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const start = css.indexOf('/* Form inputs & controls in light mode');
    const block = css.slice(start, css.indexOf('/* Popovers and floating menus', start));
    const selectors = block.match(/html:not\(\.dark\) (?:input|select|textarea)[^,{]*/g) ?? [];
    expect(selectors.length).toBeGreaterThan(0);
    for (const s of selectors) expect(s).toContain(':not([data-ds])');
  });
});

describe('SearchField', () => {
  it('forwards clicks on the shortcut chip and icon to onClick', () => {
    const onClick = vi.fn();
    render(<SearchField readOnly placeholder="Search workspace" shortcut="Ctrl K" onClick={onClick} />);
    fireEvent.click(screen.getByText('Ctrl K'));
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Search workspace'));
    expect(onClick).toHaveBeenCalledTimes(2);
  });
  it('still accepts typing', () => {
    const onChange = vi.fn();
    render(<SearchField placeholder="Search orders" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Search orders'), { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalledOnce();
  });
});

function RadioHarness() {
  const [value, setValue] = useState('original');
  return (
    <RadioCardGroup
      aria-label="Refund method"
      value={value}
      onChange={setValue}
      options={[
        { value: 'credit', icon: Wallet, title: 'Store credit' },
        { value: 'original', icon: Undo2, title: 'Original payment' },
        { value: 'bank', icon: Landmark, title: 'Bank transfer' },
      ]}
    />
  );
}

describe('RadioCardGroup', () => {
  it('exposes a radiogroup with roving tabindex and arrow key selection', () => {
    render(<RadioHarness />);
    expect(screen.getByRole('radiogroup', { name: 'Refund method' })).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    act(() => radios[1].focus());
    fireEvent.keyDown(radios[1], { key: 'ArrowDown' });
    expect(screen.getByRole('radio', { name: /Bank transfer/ }).getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: /Bank transfer/ }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: /Store credit/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(screen.getByRole('radio', { name: /Bank transfer/ }).getAttribute('aria-checked')).toBe('true');
  });
  it('makes the first radio tabbable when nothing is selected and hides the dot', () => {
    const { container } = render(
      <RadioCardGroup
        aria-label="Pick"
        value=""
        onChange={() => {}}
        options={[{ value: 'a', icon: Wallet, title: 'A' }, { value: 'b', icon: Undo2, title: 'B' }]}
      />,
    );
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1]);
    const dots = container.querySelectorAll('[data-radio-dot]');
    expect(dots.length).toBe(2);
    for (const d of Array.from(dots)) expect(d.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Switch', () => {
  it('has an accessible name from aria-label when there is no visible label', () => {
    render(<Switch aria-label="Notify customer" checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Notify customer' })).toBeTruthy();
  });
  it('requires a label or aria-label at the type level', () => {
    // @ts-expect-error a switch without label or aria-label has no accessible name
    const unnamed = <Switch checked onCheckedChange={() => {}} />;
    expect(unnamed).toBeTruthy();
  });
  it('has an accessible name from label', () => {
    render(<Switch label="Live sync" checked onCheckedChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Live sync' })).toBeTruthy();
  });
});

describe('Tabs keyboard', () => {
  it('uses roving tabindex and Left/Right arrows', () => {
    function Harness() {
      const [v, setV] = useState('a');
      return <Tabs value={v} onChange={setV} items={[{ key: 'a', label: 'All' }, { key: 'b', label: 'Ready' }, { key: 'c', label: 'Done' }]} />;
    }
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    act(() => tabs[0].focus());
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Ready' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Ready' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Done' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, -1, 0]);
  });
});

describe('Button hover states', () => {
  it('gives every variant a token-based hover', () => {
    render(
      <>
        <Button variant="primary">P</Button>
        <Button variant="secondary">S</Button>
        <Button variant="ghost">G</Button>
        <Button variant="danger">D</Button>
      </>,
    );
    expect(screen.getByText('P').className).toContain('hover:brightness-95');
    expect(screen.getByText('S').className).toContain('hover:bg-chip');
    expect(screen.getByText('G').className).toContain('hover:bg-chip');
    expect(screen.getByText('D').className).toContain('hover:brightness-95');
  });
});

describe('PageHeroHeader badge tones', () => {
  it('maps purple to the wait (violet) family', () => {
    render(<PageHeroHeader title="Orders" badge={{ label: 'Beta', variant: 'purple' }} />);
    expect(screen.getByText('Beta').className).toContain('text-st-wait-fg');
  });
});
