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
        richColors
        closeButton
        toastOptions={{
          style: {
            background: theme === 'dark' ? 'rgba(18, 18, 22, 0.95)' : 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(24, 24, 27, 0.1)',
            borderRadius: '14px',
            color: theme === 'dark' ? '#ffffff' : '#18181b',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.28)',
            padding: '14px 16px',
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
