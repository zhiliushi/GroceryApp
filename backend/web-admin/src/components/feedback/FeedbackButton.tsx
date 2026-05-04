/**
 * FeedbackButton — persistent floating "💬 Feedback" pill.
 *
 * Captured 2026-05-04 from the customer-feedback design pass. Up to
 * this point the only feedback trigger was CapHitPrompt (fires when
 * the shopping-list 15-primary / 3-alt cap is hit), so 90% of feedback
 * moments had no channel. This is the catch-all surface.
 *
 * Mount: once globally in AppLayout (sibling to FloatingScanButton +
 * StickyAddButton). Hidden on auth-state pages by mounting inside the
 * authenticated AppLayout, not on the standalone /login route.
 *
 * Position:
 *   - Desktop (md+): top-4 right-[200px], between Add and the household
 *     switcher pill. Same safe-zone as the rest of the floating UI;
 *     respects the `md:pt-16` reservation in AppLayout.
 *   - Mobile: bottom-right FAB. Co-exists with PrimaryActionFab by
 *     stacking — feedback FAB sits above the primary FAB.
 *
 * Submission:
 *   - Auto-attached context: page_path, user_agent, app_version,
 *     breadcrumb_routes (last 5 via useRouteHistory).
 *   - Wraps the existing useSubmitFeedback mutation; backend writes the
 *     doc, fires the Telegram notification, returns. Toast confirms.
 *   - Modal is plain `<details>`-style trapped focus; closes on submit.
 *
 * Privacy: the auto-context is the same data the page already sees —
 * user_agent and current path are not new tracking. Documented in
 * docs/legal/privacy-policy.md.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import {
  useSubmitFeedback,
  type FeedbackKind,
} from '@/api/mutations/useFeedbackMutations';
import { getRouteHistory } from '@/hooks/useRouteHistory';
import { cn } from '@/utils/cn';

const KIND_OPTIONS: Array<{ value: FeedbackKind; label: string; hint: string }> = [
  { value: 'general', label: 'General', hint: 'A thought, suggestion, or anything else.' },
  { value: 'bug', label: 'Bug', hint: 'Something is broken or behaving wrong.' },
  { value: 'feature', label: 'Feature request', hint: 'Something missing you’d like to see.' },
];

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send feedback to the admin. Bug reports include the page you’re on + last 5 routes for triage."
        aria-label="Send feedback"
        className={cn(
          // Bottom-right on every breakpoint. Earlier desktop position
          // at top-4 right-[200px] overlapped the Scan + HouseholdSwitcher
          // pills (visible in the 2026-05-04 walkthrough screenshot).
          // Moved out of the top-row safe-zone entirely. On mobile we
          // sit at bottom-24 to stack above PrimaryActionFab; on desktop
          // there's no primary FAB so we anchor at bottom-4.
          'fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full shadow-lg flex items-center justify-center',
          'md:bottom-4 md:right-4 md:w-auto md:h-auto md:rounded-full md:px-3.5 md:py-2',
          'bg-ga-bg-card border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover',
        )}
      >
        <span className="text-base md:hidden" aria-hidden="true">💬</span>
        <span className="hidden md:inline-flex md:items-center md:gap-1.5 md:text-sm md:font-medium">
          <span aria-hidden="true">💬</span>
          <span>Feedback</span>
        </span>
      </button>

      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}


function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>('general');
  const [message, setMessage] = useState('');
  const submitMutation = useSubmitFeedback();
  const location = useLocation();

  const canSubmit = message.trim().length > 0 && !submitMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const context = {
      page_path: location.pathname,
      user_agent: navigator.userAgent,
      app_version: typeof window !== 'undefined'
        ? (window as unknown as { __APP_VERSION__?: string }).__APP_VERSION__ ?? null
        : null,
      breadcrumb_routes: getRouteHistory(),
      submitted_at: new Date().toISOString(),
    };

    submitMutation.mutate(
      {
        kind,
        message: message.trim(),
        source: 'web',
        context,
      },
      {
        onSuccess: () => {
          setMessage('');
          onClose();
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
    >
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <h2 id="feedback-title" className="text-lg font-semibold text-ga-text-primary">
            💬 Send feedback
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ga-text-secondary hover:text-ga-text-primary text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-ga-text-secondary leading-snug">
            Goes straight to admin. Replies appear in{' '}
            <Link
              to="/settings"
              onClick={onClose}
              className="text-ga-accent hover:underline"
            >
              Settings → My feedback
            </Link>
            .
          </p>

          <div>
            <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">
              Kind
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setKind(opt.value)}
                  title={opt.hint}
                  className={cn(
                    'text-xs px-2 py-1.5 rounded border transition-colors',
                    kind === opt.value
                      ? 'border-ga-accent bg-ga-accent/10 text-ga-accent'
                      : 'border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ga-text-secondary mt-1.5 leading-snug">
              {KIND_OPTIONS.find((o) => o.value === kind)?.hint}
            </p>
          </div>

          <div>
            <label
              htmlFor="feedback-message"
              className="block text-xs font-medium text-ga-text-secondary mb-1.5"
            >
              Message
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={5000}
              rows={5}
              autoFocus
              placeholder={
                kind === 'bug'
                  ? 'What did you expect? What happened? Steps to reproduce help a lot.'
                  : kind === 'feature'
                  ? 'Describe the feature you’d like and the situation it solves.'
                  : 'Anything you want admin to know.'
              }
              className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary focus:outline-none focus:border-ga-accent resize-none"
            />
            <p className="text-[11px] text-ga-text-secondary mt-1">
              {message.length} / 5000
            </p>
          </div>

          <div className="bg-ga-bg-hover/40 border border-ga-border rounded-md px-3 py-2 text-[11px] text-ga-text-secondary leading-snug">
            <span className="font-medium text-ga-text-primary">Auto-attached for triage:</span>{' '}
            current page (<code className="text-ga-accent">{location.pathname}</code>),
            your last few routes, and browser info. No other personal data.
          </div>

          {submitMutation.error != null && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 text-xs text-red-400">
              {(submitMutation.error as { message?: string })?.message || 'Failed to send.'}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-secondary hover:bg-ga-bg-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'px-4 py-1.5 text-sm rounded-md font-medium',
                canSubmit
                  ? 'bg-ga-accent text-white hover:opacity-90'
                  : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
              )}
            >
              {submitMutation.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
