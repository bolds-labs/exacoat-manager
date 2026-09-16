import React from 'react';
import { AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmVariant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm Action',
  cancelText = 'Cancel',
  variant,
  confirmVariant,
  isLoading = false,
}) => {
  const actualVariant = variant || confirmVariant || 'danger';

  const icons = {
    danger: <AlertCircle className="w-5 h-5 text-rose-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    info: <ShieldAlert className="w-5 h-5 text-[#f3aa18]" />,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={title}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>{cancelText}</Button>
          <Button type="button" variant={actualVariant === 'danger' ? 'danger' : actualVariant === 'warning' ? 'secondary' : 'primary'} onClick={onConfirm} isLoading={isLoading}>{confirmText}</Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', actualVariant === 'danger' ? 'border-rose-500/20 bg-rose-500/10' : actualVariant === 'warning' ? 'border-amber-500/20 bg-amber-500/10' : 'border-[#f3aa18]/20 bg-[#f3aa18]/10')}>
          {icons[actualVariant]}
        </div>
        <p className="pt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
    </Modal>
  );
};
