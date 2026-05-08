import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const AUTO_DISMISS_MS = 3000;

const BORDER_COLOR: Record<ToastType, string> = {
  success: '#22c55e', // green-500
  error:   '#ef4444', // red-500
  info:    '#3b82f6', // blue-500
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// ---- ToastProvider --------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // Clean up pending timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error:   (msg: string) => addToast('error', msg),
    info:    (msg: string) => addToast('info', msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToasterInternal toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ---- useToast hook --------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

// ---- Internal Toaster component ------------------------------------------

interface ToasterInternalProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToasterInternal({ toasts, onDismiss }: ToasterInternalProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        zIndex: 9999,
        width: '22rem',
        maxWidth: 'calc(100vw - 2rem)',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ---- ToastItem ------------------------------------------------------------

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);

  // Trigger slide-in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        backgroundColor: 'var(--toast-bg)',
        borderRadius: '0.5rem',
        boxShadow: 'var(--toast-shadow)',
        borderLeft: `4px solid ${BORDER_COLOR[toast.type]}`,
        borderTop: '1px solid var(--toast-border)',
        borderRight: '1px solid var(--toast-border)',
        borderBottom: '1px solid var(--toast-border)',
        padding: '0.75rem 1rem',
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.25s ease, opacity 0.25s ease',
        pointerEvents: 'auto',
      }}
    >
      <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--toast-text)', lineHeight: 1.4 }}>
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Close notification"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.125rem',
          color: '#9ca3af',
          fontSize: '1rem',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        &#x2715;
      </button>
    </div>
  );
}

// ---- Exported Toaster (standalone use, outside ToastProvider) -------------

/**
 * Drop-in `<Toaster />` component.
 * When used inside `<ToastProvider>`, the provider already renders the toaster
 * internally. This export is provided for convenience / standalone use.
 */
export function Toaster() {
  const ctx = useContext(ToastContext);
  // Toaster is only meaningful inside a provider; render nothing otherwise.
  if (!ctx) return null;
  // The provider already mounts ToasterInternal — nothing extra to render here.
  return null;
}
