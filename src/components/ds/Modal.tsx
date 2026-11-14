import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  reference?: string;
  /** One short line under the title. */
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** Lets a caller keep the modal open on Escape (call preventDefault), e.g. to cancel an inline edit first. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

// Clicking a toast (for example its close button) must not dismiss the modal underneath.
export const isToastTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-sonner-toaster]'));

export function Modal({ open, onOpenChange, title, reference, description, children, footer, width = 520, onEscapeKeyDown }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black" style={{ opacity: 0.55 }} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ width }}
          onEscapeKeyDown={onEscapeKeyDown}
          onInteractOutside={(e) => {
            if (isToastTarget(e.target)) e.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 z-[210] flex max-h-[calc(100vh-48px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-card-border bg-pop text-fg shadow-[0_24px_60px_rgba(0,0,0,0.45)] focus:outline-none"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-[18px]">
            <div className="min-w-0">
              <div className="flex items-baseline">
                <Dialog.Title className="mr-2.5 text-base font-semibold">{title}</Dialog.Title>
                {reference && <span className="font-mono text-[13px] text-faint">{reference}</span>}
              </div>
              {description && <p className="mt-0.5 text-[12px] text-faint">{description}</p>}
            </div>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" variant="ghost" size="sm" />
            </Dialog.Close>
          </header>
          <div className="flex flex-col gap-3.5 overflow-y-auto p-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line bg-pop px-5 py-3.5">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
