import { useState } from 'react';
import { useSubmitFeedback, type FeedbackSource } from '@/api/mutations/useFeedbackMutations';

interface CapHitPromptProps {
  /** Why the cap fired — drives messaging + the source tag on the feedback. */
  capType: 'primary' | 'alternative';
  /** Cap value (e.g. 15 or 3) — embedded into the displayed message. */
  capValue: number;
  /** Optional structured context (list_id, item_id, etc.) attached to the feedback. */
  context?: Record<string, unknown>;
  onClose: () => void;
}

/**
 * Inline modal that appears when a user hits the beta cap on shopping-list
 * primaries (15) or alternatives (3). Lets the user describe what they were
 * trying to do — admin uses these to decide whether to bump caps.
 *
 * Per the v3 design discussion (Shahir, 2026-05-04): cap-hit feedback is
 * the input signal for cap revisits. Future raspberry-pi capture writes
 * to the same endpoint with source='rpi_voice'.
 */
export default function CapHitPrompt({
  capType,
  capValue,
  context,
  onClose,
}: CapHitPromptProps) {
  const [message, setMessage] = useState('');
  const submitMutation = useSubmitFeedback();

  const headline =
    capType === 'primary'
      ? `You've hit the ${capValue}-primary cap on this list (beta).`
      : `You've hit the ${capValue}-alternatives cap on this primary (beta).`;
  const body =
    capType === 'primary'
      ? "We're tracking how often this happens to know whether to raise the limit."
      : "We're tracking how often this happens to know whether to raise the limit.";
  const source: FeedbackSource =
    capType === 'primary' ? 'cap_hit_primary' : 'cap_hit_alternative';

  function handleSubmit() {
    if (!message.trim()) {
      onClose();
      return;
    }
    submitMutation.mutate(
      {
        kind: 'cap_request',
        message: message.trim(),
        source,
        context: { cap_type: capType, cap_value: capValue, ...(context || {}) },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-sm font-semibold text-ga-text-primary">{headline}</h3>
          <p className="text-xs text-ga-text-secondary mt-1">{body}</p>
        </div>
        <div className="px-5 py-4 space-y-2">
          <label className="block text-xs font-medium text-ga-text-secondary">
            Tell us what you were trying to do (optional)
          </label>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="e.g. Weekly shop for a household of 5; need at least 25 items per list."
            className="w-full px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent resize-y"
          />
          <p className="text-[10px] text-ga-text-secondary">
            Empty submission just dismisses without sending.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
          >
            Dismiss
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
