import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  header: ReactNode;
  children?: ReactNode;
  width?: number;
  label?: string;
}

export function Drawer({ open, onOpenChange, header, children, width = 1180, label = 'Details' }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black" style={{ opacity: 0.45 }} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ width }}
          className="fixed bottom-0 right-0 top-0 z-[110] flex max-w-[calc(100vw-48px)] flex-col border-l border-card-border bg-panel text-fg shadow-[-20px_0_50px_rgba(0,0,0,0.3)] focus:outline-none"
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <div className="flex-none border-b border-line">{header}</div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
