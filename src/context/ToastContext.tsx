import React, { createContext, useContext, ReactNode } from 'react';
import { toast, Toaster } from 'sonner';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastContextType {
  showToast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const showToast = (type: ToastType, title: string, description?: string) => {
    switch (type) {
      case 'success':
        toast.success(title, { description });
        break;
      case 'error':
        toast.error(title, { description });
        break;
      case 'warning':
        toast.warning(title, { description });
        break;
      default:
        toast.info(title, { description });
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toaster 
        theme="dark" 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: '#111116',
            color: '#f4f4f5',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
          },
        }}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
