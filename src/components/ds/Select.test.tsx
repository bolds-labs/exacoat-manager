// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { Select } from './Select';

beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const options = [
  { value: '', label: 'All couriers' },
  { value: 'jne', label: 'JNE' },
  { value: 'jnt', label: 'J&T' },
];

function open(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

describe('kit Select (styled listbox)', () => {
  it('renders the selected label in the trigger', () => {
    render(<Select aria-label="Courier" value="jne" onChange={() => {}} options={options} />);
    expect(screen.getByRole('combobox', { name: 'Courier' }).textContent).toContain('JNE');
  });

  it('shows the empty-value option label in the trigger', () => {
    render(<Select aria-label="Courier" value="" onChange={() => {}} options={options} />);
    expect(screen.getByRole('combobox').textContent).toContain('All couriers');
  });

  it('opens and lists the options', () => {
    render(<Select aria-label="Courier" value="jne" onChange={() => {}} options={options} />);
    open(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('calls onChange with the caller value', () => {
    const onChange = vi.fn();
    render(<Select aria-label="Courier" value="jne" onChange={onChange} options={options} />);
    open(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'J&T' }));
    expect(onChange).toHaveBeenCalledWith('jnt');
  });

  it('maps the empty value back to an empty string', () => {
    const onChange = vi.fn();
    render(<Select aria-label="Courier" value="jne" onChange={onChange} options={options} />);
    open(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'All couriers' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not open when disabled', () => {
    render(<Select aria-label="Courier" value="jne" onChange={() => {}} options={options} disabled />);
    const trigger = screen.getByRole('combobox');
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    open(trigger);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('associates the visible label with the trigger', () => {
    render(<Select label="Courier" value="jne" onChange={() => {}} options={options} />);
    expect(screen.getByLabelText('Courier').getAttribute('role')).toBe('combobox');
  });
});
