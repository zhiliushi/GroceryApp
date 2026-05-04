import { Link } from 'react-router-dom';

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

/**
 * Shared layout for legal pages (privacy, terms). Renders a no-frills,
 * easy-to-read view that works for both authenticated and unauthenticated
 * visitors — these pages are publicly reachable.
 *
 * Source of truth: docs/legal/*.md. The TSX text below mirrors those files;
 * if they drift, treat the .md as canonical (a lawyer reviews the .md).
 */
export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-ga-bg-primary">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          to="/dashboard"
          title="Return to the app. You don't need to be signed in to read this page."
          className="text-sm text-ga-accent hover:underline inline-flex items-center gap-1"
        >
          ← Back to app
        </Link>
        <h1 className="text-3xl font-bold text-ga-text-primary mt-4 mb-1">{title}</h1>
        <p
          className="text-xs text-ga-text-secondary mb-4"
          title="Material changes are announced in-app and via email. The date here flips when the document changes meaningfully — typo fixes don't bump it."
        >Last updated: {lastUpdated}</p>

        <details className="bg-ga-bg-card border border-ga-border rounded-lg group mb-6">
          <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
            <span>ⓘ How to read this page</span>
            <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
            <p>
              <span className="text-ga-text-primary font-medium">This page is public.</span>{' '}
              You can share the link with anyone — no sign-in required.
            </p>
            <p>
              <span className="text-ga-text-primary font-medium">Numbered sections</span>{' '}
              are independent — jump to whichever one answers your question. Most readers
              only need section 6 (your rights / your content) and section 13 / 11 (contact).
            </p>
            <p>
              <span className="text-ga-text-primary font-medium">Cross-links</span> at the
              bottom let you switch between Privacy and Terms without going through the app.
            </p>
            <p>
              <span className="text-ga-text-primary font-medium">If something is unclear</span>{' '}
              email the contact in the last section. We&apos;d rather answer your question
              than have you guess at meaning.
            </p>
          </div>
        </details>

        <article className="prose prose-sm max-w-none text-ga-text-primary space-y-4 leading-relaxed">
          {children}
        </article>
        <footer className="mt-12 pt-6 border-t border-ga-border text-xs text-ga-text-secondary">
          <p>
            Cross-links:{' '}
            <Link to="/privacy" className="text-ga-accent hover:underline">
              Privacy Policy
            </Link>
            {' · '}
            <Link to="/terms" className="text-ga-accent hover:underline">
              Terms of Service
            </Link>
            {' · '}
            <Link to="/dashboard" className="text-ga-accent hover:underline">
              App
            </Link>
          </p>
          <p className="mt-2">
            This is a beta-stage template, not legal advice. Operator: [Your Name / Company].
          </p>
        </footer>
      </div>
    </div>
  );
}
