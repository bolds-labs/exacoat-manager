import { useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  header: ReactNode;
  children?: ReactNode;
  width?: number;
  label?: string;
}

/**
 * Side drawer. Non-modal on purpose: legacy modals opened from inside it render in their own
 * portal at a higher z-index and must stay clickable and focusable, so Radix must not hide
 * siblings or block outside pointer events. The drawer renders its own scrim, closes on scrim
 * click and on Escape (unless focus sits in another dialog stacked above it).
 */
export function Drawer({ open, onOpenChange, header, children, width = 1180, label = 'Details' }: DrawerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <div
          data-drawer-scrim=""
          aria-hidden
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-[100] bg-black"
          style={{ opacity: 0.45 }}
        />
        <Dialog.Content
          ref={contentRef}
          aria-describedby={undefined}
          style={{ width }}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            const active = document.activeElement;
            const inOtherDialog =
              active instanceof Element &&
              !contentRef.current?.contains(active) &&
              active.closest('[role="dialog"], [role="alertdialog"]');
            if (inOtherDialog) e.preventDefault();
          }}
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
