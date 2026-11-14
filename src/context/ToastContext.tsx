import React, { createContext, useContext, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { useTheme } from './ThemeContext';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const removeToast = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000) => {
      const opts = {
        description: message,
        duration,
      };

      switch (type) {
        case 'success':
          toast.success(title, opts);
          break;
        case 'error':
          toast.error(title, opts);
          break;
        case 'warning':
          toast.warning(title, opts);
          break;
        case 'info':
        default:
          toast.info(title, opts);
          break;
      }
    },
    []
  );

  const contextValue = React.useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Toaster
        theme={theme}
        position="bottom-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: '!rounded-xl !border !border-card-border !bg-pop !text-fg !font-sans !shadow-[0_12px_30px_rgba(0,0,0,0.3)] !px-3.5 !py-3 data-[type=success]:![background-image:linear-gradient(var(--st-done-bg),var(--st-done-bg))] data-[type=success]:!border-st-done-border data-[type=success]:!text-st-done-fg data-[type=error]:![background-image:linear-gradient(var(--st-stop-bg),var(--st-stop-bg))] data-[type=error]:!border-st-stop-border data-[type=error]:!text-st-stop-fg data-[type=warning]:![background-image:linear-gradient(var(--st-wait-bg),var(--st-wait-bg))] data-[type=warning]:!border-st-wait-border data-[type=warning]:!text-st-wait-fg data-[type=info]:![background-image:linear-gradient(var(--st-prog-bg),var(--st-prog-bg))] data-[type=info]:!border-st-prog-border data-[type=info]:!text-st-prog-fg',
            title: '!text-[13.5px] !font-medium',
            description: '!text-[12.5px] !text-faint',
            closeButton: '!bg-pop !border-card-border !text-muted',
          },
        }}
      />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
