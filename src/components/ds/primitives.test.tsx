// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Plus } from 'lucide-react';
import { Button, Checkbox, CountPill, IconButton, RadioCard, SearchField, Select, Switch, TextField } from './index';

afterEach(cleanup);

describe('Button', () => {
  it('uses h-9 for md and h-[30px] for sm', () => {
    render(<><Button>Md</Button><Button size="sm">Sm</Button></>);
    expect(screen.getByText('Md').closest('button')!.className).toContain('h-9');
    expect(screen.getByText('Sm').closest('button')!.className).toContain('h-[30px]');
  });
  it('primary uses the accent token', () => {
    render(<Button variant="primary">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-accent');
  });
  it('renders icons and forwards native props', () => {
    const onClick = vi.fn();
    render(<Button icon={Plus} onClick={onClick}>Add</Button>);
    const btn = screen.getByRole('button', { name: 'Add' });
    expect(btn.querySelector('svg')).not.toBeNull();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('IconButton', () => {
  it('renders aria-label', () => {
    render(<IconButton icon={Plus} label="Refresh" />);
    expect(screen.getByLabelText('Refresh')).toBeTruthy();
  });
});

describe('CountPill', () => {
  it('hot tone uses text-accent-fg', () => {
    render(<CountPill value={4} tone="hot" />);
    expect(screen.getByText('4').className).toContain('text-accent-fg');
  });
});

describe('fields', () => {
  it('TextField renders label and is h-9', () => {
    render(<TextField label="Amount" />);
    expect(screen.getByText('Amount')).toBeTruthy();
    expect(screen.getByLabelText('Amount').closest('div')!.className).toContain('h-9');
  });
  it('Select renders label, tag and reports changes', () => {
    const onChange = vi.fn();
    render(
      <Select label="Method" tag="Midtrans" value="a" onChange={onChange}
        options={[{ value: 'a', label: 'Store credit' }, { value: 'b', label: 'Original' }]} />,
    );
    expect(screen.getByText('Method')).toBeTruthy();
    expect(screen.getByText('Midtrans')).toBeTruthy();
    const sel = screen.getByLabelText('Method');
    expect(sel.closest('div')!.className).toContain('h-9');
    fireEvent.change(sel, { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Switch', () => {
  it('calls onCheckedChange(true) on click', () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} label="Notify" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('RadioCard', () => {
  it('selected has aria-checked true', () => {
    const onSelect = vi.fn();
    render(<RadioCard selected icon={Plus} title="Store credit" onSelect={onSelect} />);
    const r = screen.getByRole('radio');
    expect(r.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(r);
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('token classes', () => {
  it('danger Button uses the explicit border token', () => {
    render(<Button variant="danger">Cancel order</Button>);
    expect(screen.getByRole('button', { name: 'Cancel order' }).className).toContain('border-st-stop-border');
  });
  it('selected RadioCard uses the explicit accent border token', () => {
    render(<RadioCard selected icon={Plus} title="A" onSelect={() => {}} />);
    expect(screen.getByRole('radio').className).toContain('border-accent-border');
  });
  it('no component emits an opacity suffix on a token colour', () => {
    const { container } = render(
      <>
        <Button variant="primary" icon={Plus}>a</Button>
        <Button variant="danger">b</Button>
        <IconButton icon={Plus} label="c" />
        <CountPill value={1} tone="hot" />
        <TextField label="d" />
        <Select label="e" tag="t" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} />
        <SearchField placeholder="f" shortcut="/" />
        <Checkbox label="g" />
        <Switch checked onCheckedChange={() => {}} label="h" />
        <RadioCard selected icon={Plus} title="i" onSelect={() => {}} />
      </>,
    );
    const bad = /\b(accent|st-[a-z]+-(fg|bg|border)|fg|muted|faint|chip|field|line)\/\d+/;
    for (const el of Array.from(container.querySelectorAll('[class]'))) {
      const cls = el.getAttribute('class') ?? '';
      expect(cls, cls).not.toMatch(bad);
    }
  });
  it('callers cannot override the internal handlers', () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Sync" checked={false} onCheckedChange={onCheckedChange} onClick={() => {}} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
