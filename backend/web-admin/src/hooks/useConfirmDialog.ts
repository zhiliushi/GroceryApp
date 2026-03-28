import { useState, useCallback } from 'react';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: 'danger' | 'default';
  onConfirm: () => void;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState | null>(null);

  const confirm = useCallback(
    (opts: Omit<ConfirmDialogState, 'isOpen'>) => {
      setState({ ...opts, isOpen: true });
    },
    [],
  );

  const close = useCallback(() => setState(null), []);

  return { state, confirm, close };
}
