import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import ToastMessage from '../components/ToastMessage';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastState {
  message: string;
  type: ToastType;
  position?: 'top-right' | 'bottom-right';
}

interface ToastContextValue {
  toast: ToastState | null;
  showToast: (message: string, type?: ToastType, options?: { position?: 'top-right' | 'bottom-right' }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children, duration = 3000 }: { children: ReactNode; duration?: number }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (
    message: string,
    type: ToastType = 'error',
    options?: { position?: 'top-right' | 'bottom-right' }
  ) => {
    setToast({ message, type, position: options?.position ?? 'top-right' });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, showToast }}>
      {children}
      <ToastMessage
        toast={toast}
        positionClassName={toast?.position === 'bottom-right' ? 'bottom-4 right-4 z-[70]' : 'top-4 right-4 z-50'}
        textClassName={toast?.position === 'bottom-right' ? 'text-sm font-medium' : ''}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
