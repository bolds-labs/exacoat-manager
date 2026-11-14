import type { ReactNode } from 'react';
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

export function Tabs({ items, value, onChange, trailing }: TabsProps) {
  return (
    <div className="flex items-center gap-1">
      <div role="tablist" className="flex items-center gap-1">
        {items.map((item) => {
          const active = item.key === value;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
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
