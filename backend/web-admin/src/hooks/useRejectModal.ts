import { useState, useCallback } from 'react';

export interface RejectModalState {
  isOpen: boolean;
  title: string;
  onSubmit: (reason: string) => void;
}

export function useRejectModal() {
  const [state, setState] = useState<RejectModalState | null>(null);

  const open = useCallback(
    (opts: Omit<RejectModalState, 'isOpen'>) => {
      setState({ ...opts, isOpen: true });
    },
    [],
  );

  const close = useCallback(() => setState(null), []);

  return { state, open, close };
}
