import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CountPill } from './CountPill';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  hot?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  trailing?: ReactNode;
}

/** Tab strip with roving tabindex: only the active tab is tabbable; Left/Right (and Home/End) move and activate. */
export function Tabs({ items, value, onChange, trailing }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = items.findIndex((i) => i.key === value);
  const tabStop = activeIndex >= 0 ? activeIndex : 0;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    const current = refs.current.findIndex((el) => el === document.activeElement);
    const from = current >= 0 ? current : tabStop;
    let next: number;
    if (e.key === 'ArrowRight') next = (from + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (from - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].key);
  };

  return (
    <div className="flex items-center gap-1">
      <div role="tablist" className="flex items-center gap-1" onKeyDown={onKeyDown}>
        {items.map((item, i) => {
          const active = item.key === value;
          return (
            <button
              key={item.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={i === tabStop ? 0 : -1}
              onClick={() => onChange(item.key)}
              className={`flex items-center gap-1.5 rounded-[8px] border px-[11px] py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active ? 'border-card-border bg-chip text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              {item.label}
              {item.count !== undefined && <CountPill value={item.count} tone={item.hot ? 'hot' : 'neutral'} />}
            </button>
          );
        })}
      </div>
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
