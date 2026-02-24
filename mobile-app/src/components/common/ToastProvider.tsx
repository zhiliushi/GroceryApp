import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {Snackbar} from 'react-native-paper';
import {useAppTheme} from '../../hooks/useAppTheme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = 'info' | 'success' | 'error' | 'warning';

interface ToastOptions {
  message: string;
  type?: ToastType;
  /** Duration in milliseconds. Defaults to 3000. Use 0 for indefinite. */
  duration?: number;
  /** Action button label (e.g. "Undo"). */
  actionLabel?: string;
  /** Callback when action button is pressed. */
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  showSuccess: (message: string) => void;
  showError: (message: string, onRetry?: () => void) => void;
  showInfo: (message: string) => void;
  showUndo: (message: string, onUndo: () => void) => void;
  dismiss: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

/** Access toast functions from any component. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Wrap your app in <ToastProvider> to enable toast messages.
 * Uses react-native-paper Snackbar under the hood.
 *
 * Usage:
 *   const {showSuccess, showError, showUndo} = useToast();
 *   showSuccess('Item saved');
 *   showError('Failed to save', onRetry);
 *   showUndo('Item deleted', onUndo);
 */
export default function ToastProvider({
  children,
}: ToastProviderProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ToastOptions>({message: ''});
  const queueRef = useRef<ToastOptions[]>([]);

  const showNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setCurrent(next);
      setVisible(true);
    }
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      if (visible) {
        // Queue if a toast is already showing
        queueRef.current.push(options);
      } else {
        setCurrent(options);
        setVisible(true);
      }
    },
    [visible],
  );

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    // Show queued toast after a brief delay
    setTimeout(showNext, 200);
  }, [showNext]);

  const showSuccess = useCallback(
    (message: string) => showToast({message, type: 'success'}),
    [showToast],
  );

  const showError = useCallback(
    (message: string, onRetry?: () => void) =>
      showToast({
        message,
        type: 'error',
        duration: 5000,
        actionLabel: onRetry ? 'Retry' : undefined,
        onAction: onRetry,
      }),
    [showToast],
  );

  const showInfo = useCallback(
    (message: string) => showToast({message, type: 'info'}),
    [showToast],
  );

  const showUndo = useCallback(
    (message: string, onUndo: () => void) =>
      showToast({
        message,
        type: 'info',
        duration: 5000,
        actionLabel: 'Undo',
        onAction: onUndo,
      }),
    [showToast],
  );

  const {colors} = useAppTheme();

  const getBackgroundColor = (type?: ToastType): string => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.danger;
      case 'warning':
        return colors.warning;
      default:
        return colors.surfaceVariant;
    }
  };

  const bgColor = getBackgroundColor(current.type);

  return (
    <ToastContext.Provider
      value={{showToast, showSuccess, showError, showInfo, showUndo, dismiss}}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={handleDismiss}
        duration={current.duration ?? 3000}
        action={
          current.actionLabel
            ? {
                label: current.actionLabel,
                onPress: () => {
                  current.onAction?.();
                  dismiss();
                },
                textColor: colors.textInverse,
              }
            : undefined
        }
        style={{backgroundColor: bgColor}}>
        {current.message}
      </Snackbar>
    </ToastContext.Provider>
  );
}
