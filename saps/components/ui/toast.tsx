"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

interface Toast {
  id: string;
  message: string;
  undoAction?: () => void;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, undoAction?: () => void, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, undoAction?: () => void, duration: number = 5000) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, undoAction, duration }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — fixed bottom-center */}
      <div
        className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 200); // Wait for exit animation
    }, toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  function handleUndo() {
    toast.undoAction?.();
    setExiting(true);
    setTimeout(onDismiss, 200);
  }

  return (
    <div
      className={`
        flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3
        shadow-lg transition-all duration-200 min-w-[300px] max-w-[480px]
        ${exiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}
      `}
      role="status"
    >
      <p className="flex-1 text-sm text-foreground">{toast.message}</p>
      {toast.undoAction && (
        <button
          type="button"
          className="min-h-[32px] rounded-md px-3 py-1 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={handleUndo}
        >
          Undo
        </button>
      )}
      <button
        type="button"
        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => {
          setExiting(true);
          setTimeout(onDismiss, 200);
        }}
        aria-label="Dismiss"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
