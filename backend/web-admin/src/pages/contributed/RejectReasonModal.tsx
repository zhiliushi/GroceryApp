import { useState, useEffect, useRef } from 'react';
import type { RejectModalState } from '@/hooks/useRejectModal';

interface RejectReasonModalProps {
  state: RejectModalState | null;
  onClose: () => void;
}

export default function RejectReasonModal({ state, onClose }: RejectReasonModalProps) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.isOpen) {
      setReason('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [state?.isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state?.isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [state?.isOpen, onClose]);

  if (!state?.isOpen) return null;

  const handleSubmit = () => {
    if (!reason.trim()) return;
    state.onSubmit(reason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ga-text-primary">{state.title}</h3>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary text-lg">×</button>
        </div>
        <div className="px-5 py-4">
          <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">
            Reason for rejection
          </label>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={3}
            className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary placeholder:text-gray-600 outline-none focus:border-ga-accent focus:ring-1 focus:ring-ga-accent/30 resize-y"
          />
        </div>
        <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim()}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
