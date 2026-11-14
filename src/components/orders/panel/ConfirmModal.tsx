import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Modal } from '../../ds/Modal';
import { Button } from '../../ds/Button';

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  reference?: string;
  children?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  /** Destructive confirmations (cancel order, trash, reject) use `danger`. */
  tone?: 'primary' | 'danger';
  icon?: LucideIcon;
  isLoading?: boolean;
  confirmDisabled?: boolean;
  onConfirm(): void;
  /** Runs instead of plain closing when the secondary button is pressed. */
  onCancel?(): void;
  width?: number;
}

/** Kit Modal confirmation: ghost Cancel plus one primary or danger action. Cannot be dismissed while busy. */
export function ConfirmModal({
  open,
  onOpenChange,
  title,
  reference,
  children,
  confirmLabel,
  busyLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  icon,
  isLoading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  width = 460,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o && isLoading) return;
        onOpenChange(o);
      }}
      title={title}
      reference={reference}
      width={width}
      footer={
        <>
          <Button variant="ghost" disabled={isLoading} onClick={() => (onCancel ? onCancel() : onOpenChange(false))}>
            {cancelLabel}
          </Button>
          <Button variant={tone} icon={icon} disabled={isLoading || confirmDisabled} onClick={onConfirm}>
            {isLoading && busyLabel ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/** Body paragraph for confirmations. */
export function ConfirmText({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13.5px] leading-relaxed text-muted">{children}</p>;
}

export const textareaClass =
  'w-full rounded-[9px] border border-field-border bg-field px-3 py-2 text-[13.5px] text-fg outline-none placeholder:text-faint focus:border-accent';
