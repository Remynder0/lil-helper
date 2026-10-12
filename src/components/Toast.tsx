import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** ms until auto-dismiss (default: 4000) */
  duration?: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Icons (inline SVG — no external dep) ────────────────────────────────────

const icons: Record<ToastType, React.ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

// Per-type colour tokens (Tailwind classes referencing the project palette)
const styles: Record<ToastType, { border: string; icon: string; bar: string }> = {
  success: {
    border: 'border-deadlock-win/70',
    icon: 'text-deadlock-win',
    bar: 'bg-deadlock-win',
  },
  error: {
    border: 'border-deadlock-ritual/80',
    icon: 'text-deadlock-ritual',
    bar: 'bg-deadlock-ritual',
  },
  info: {
    border: 'border-deadlock-archmother/60',
    icon: 'text-deadlock-archmother',
    bar: 'bg-deadlock-archmother',
  },
  warning: {
    border: 'border-deadlock-hidden-king/70',
    icon: 'text-deadlock-hidden-king',
    bar: 'bg-deadlock-hidden-king',
  },
};

// ─── Single Toast Card ────────────────────────────────────────────────────────

interface ToastCardProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss }) => {
  const duration = toast.duration ?? 4000;
  const { border, icon: iconColor, bar } = styles[toast.type];

  // Animate progress bar shrink
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    // Force reflow so the transition starts from 100%
    el.getBoundingClientRect();
    el.style.transitionDuration = `${duration}ms`;
    el.style.width = '0%';
  }, [duration]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        // Layout & shape
        'relative flex items-start gap-3 w-80 px-4 pt-3 pb-4 rounded-sm overflow-hidden',
        // Background — dark panel with slight opacity
        'bg-deadlock-panel/95 backdrop-blur-sm',
        // Border — left accent + subtle full border
        `border border-l-2 ${border}`,
        // Shadow — brass glow
        'shadow-[0_4px_24px_rgba(0,0,0,0.6)]',
        // Slide-in from right
        'animate-[slideInRight_0.25s_ease-out]',
      ].join(' ')}
    >
      {/* Icon */}
      <span className={`mt-0.5 ${iconColor}`}>{icons[toast.type]}</span>

      {/* Message */}
      <p className="flex-1 text-sm text-deadlock-steam leading-snug">{toast.message}</p>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-deadlock-muted/60 hover:text-deadlock-muted transition-colors mt-0.5 shrink-0"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22Z" />
        </svg>
      </button>

      {/* Progress bar (shrinks over `duration` ms) */}
      <div
        ref={barRef}
        className={`absolute bottom-0 left-0 h-0.5 w-full transition-[width] ease-linear ${bar} opacity-60`}
        style={{ transitionDuration: `${duration}ms` }}
      />
    </div>
  );
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    // Auto-dismiss
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const ctx: ToastContextValue = {
    success: (msg, dur) => push('success', msg, dur),
    error: (msg, dur) => push('error', msg, dur),
    info: (msg, dur) => push('info', msg, dur),
    warning: (msg, dur) => push('warning', msg, dur),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Portal-like stack at bottom-right above all content */}
      <div
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
};
