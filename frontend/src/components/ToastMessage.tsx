type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastState {
  message: string;
  type: ToastType;
}

interface ToastMessageProps {
  toast: ToastState | null;
  positionClassName?: string;
  textClassName?: string;
}

export default function ToastMessage({
  toast,
  positionClassName = 'top-4 right-4 z-50',
  textClassName = '',
}: ToastMessageProps) {
  if (!toast) return null;

  const colorClassName =
    toast.type === 'success'
      ? 'bg-green-600'
      : toast.type === 'error'
      ? 'bg-red-600'
      : toast.type === 'warning'
      ? 'bg-yellow-600'
      : 'bg-primary-600';

  return (
    <div
      className={`fixed ${positionClassName} px-4 py-3 rounded-lg shadow-lg text-white ${textClassName} ${colorClassName}`}
    >
      {toast.message}
    </div>
  );
}
