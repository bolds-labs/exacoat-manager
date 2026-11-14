import type { ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { LucideIcon } from 'lucide-react';

export type MenuItem =
  | { icon: LucideIcon; title: string; description?: string; onSelect: () => void; danger?: boolean }
  | 'separator';

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
}

export function Menu({ trigger, items, align = 'end' }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-[300] w-[300px] rounded-xl border border-card-border bg-pop p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
        >
          {items.map((item, index) => {
            if (item === 'separator') {
              return <DropdownMenu.Separator key={`sep-${index}`} className="mx-1 my-[5px] h-px bg-line" />;
            }
            const Icon = item.icon;
            const text = item.danger ? 'text-st-stop-fg' : 'text-fg';
            const iconColor = item.danger ? 'text-st-stop-fg' : 'text-muted group-data-[highlighted]:text-accent-fg';
            return (
              <DropdownMenu.Item
                key={`${item.title}-${index}`}
                onSelect={item.onSelect}
                className="group flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-[9px] outline-none data-[highlighted]:bg-chip"
              >
                <Icon className={`mt-0.5 h-4 w-4 flex-none ${iconColor}`} strokeWidth={1.8} aria-hidden />
                <span className="min-w-0">
                  <span className={`block text-[13.5px] font-medium ${text}`}>{item.title}</span>
                  {item.description && <span className="block text-[12.5px] text-faint">{item.description}</span>}
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
