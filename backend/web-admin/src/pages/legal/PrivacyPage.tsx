import LegalLayout from './LegalLayout';

/**
 * Privacy Policy — mirrors docs/legal/privacy-policy.md.
 * If you change this file, also update the markdown source.
 */
export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="2026-04-26">
      <Section title="1. What this policy covers">
        <p>
          This Privacy Policy explains how GroceryApp ("we", "the App") collects, uses, and
          protects your personal data when you use our web and mobile interfaces. By using the
          App you consent to the practices described here.
        </p>
        <p>
          GroceryApp helps you track grocery purchases, expiry dates, and reduce food waste.
          We process the minimum personal data needed to deliver that service.
        </p>
      </Section>

      <Section title="2. Data we collect">
        <p><strong>You provide directly:</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Email address and display name (via Google Sign-In through Firebase Auth)</li>
          <li>
            Items you add to your inventory: name, quantity, expiry date, location, optional
            purchase price, optional barcode
          </li>
          <li>Items you mark used / thrown / given away, and the reasons</li>
          <li>Shopping list contents</li>
          <li>
            Optional uploaded photos for barcode/receipt scanning (admin-experimental feature;
            OFF by default)
          </li>
          <li>Recipes you create (in the Meals page)</li>
        </ul>
        <p className="pt-2"><strong>Collected automatically:</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Authentication tokens (Firebase ID tokens)</li>
          <li>
            Anonymous device + browser metadata (user-agent, IP at request time, for rate-limit
            and audit log purposes only)
          </li>
          <li>Service worker logs (cached responses, sync state)</li>
          <li>Page views via the App's internal analytics (no Google Analytics)</li>
        </ul>
        <p className="pt-2"><strong>We do NOT collect:</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Payment information (no payments accepted yet)</li>
          <li>Precise location (we do NOT request browser geolocation)</li>
          <li>Contact lists, calendars, or other phone data</li>
          <li>Behavioural advertising signals — we serve no ads</li>
        </ul>
      </Section>

      <Section title="3. How we use your data">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Service delivery.</strong> Show you your inventory, compute health scores,
            send expiry reminders.
          </li>
          <li>
            <strong>Account management.</strong> Authenticate you, recover access, contact you
            about service issues.
          </li>
          <li>
            <strong>Aggregate analysis.</strong> Improve the catalog quality (admin only).
            Aggregations never include your name or email in any displayed result.
          </li>
          <li>
            <strong>Security.</strong> Detect abuse, enforce rate limits, audit administrator
            actions.
          </li>
        </ul>
        <p className="pt-2">
          We do <strong>not</strong> sell, rent, or share your personal data with advertisers or
          data brokers. We do not use your data to train AI models for third parties.
        </p>
      </Section>

      <Section title="4. Data storage and processors">
        <p>Your data is stored in:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Google Cloud Firestore (Firebase project <code>groceryapp-b91a7</code>), multi-region.</li>
          <li>Render.com (web hosting), United States.</li>
          <li>
            Optional third-party lookups when you scan a barcode: OpenFoodFacts (public open
            data; no account data sent), Google Vision / Mindee (only if <code>ocr_enabled</code>
            flag is ON; image bytes sent for OCR, never stored by us).
          </li>
        </ul>
      </Section>

      <Section title="5. Data retention">
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Active inventory.</strong> Kept until you delete it or close your account.</li>
          <li><strong>Purchase history.</strong> Kept until you delete it; used for waste-prevention insights.</li>
          <li><strong>Audit logs.</strong> 90 days, then automatically deleted.</li>
          <li><strong>Service worker caches.</strong> Cleared on app uninstall or browser cache wipe.</li>
          <li>
            <strong>After account deletion.</strong> All your personal data is purged within 30
            days from primary stores; up to 90 days from rolling backups.
          </li>
        </ul>
      </Section>

      <Section title="6. Your rights">
        <p>Under PDPA (Malaysia) and equivalent regulations:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Access.</strong> Request a copy via Settings → Export Data, or by emailing
            us. Returns a JSON dump within 7 days.
          </li>
          <li><strong>Correction.</strong> Edit your inventory and profile in-app at any time.</li>
          <li>
            <strong>Deletion.</strong> Settings → Delete Account → confirms with second click.
            Your data is purged within 30 days.
          </li>
          <li>
            <strong>Withdrawal of consent.</strong> Stop using the App at any time. We retain
            only what is required for legal/accounting reasons (currently: none).
          </li>
          <li>
            <strong>Complaint.</strong> You may complain to the Department of Personal Data
            Protection (PDP) Malaysia.
          </li>
        </ul>
      </Section>

      <Section title="7. Cookies and similar technologies">
        <p>GroceryApp uses:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>A first-party authentication token (Firebase) to keep you logged in.</li>
          <li>A service worker for offline access to the App shell.</li>
          <li>localStorage to remember UI preferences (sidebar state, dismissed nudges, theme).</li>
        </ul>
        <p className="pt-2">
          We do NOT use third-party tracking cookies, advertising pixels, or fingerprinting.
        </p>
      </Section>

      <Section title="8. Children">
        <p>
          GroceryApp is not designed for children under 13. We do not knowingly collect data
          from children. If you believe a child has signed up, contact us and we will delete the
          account.
        </p>
      </Section>

      <Section title="9. Security">
        <ul className="list-disc pl-6 space-y-1">
          <li>All traffic uses TLS 1.2+ (HTTPS).</li>
          <li>
            Firestore Security Rules restrict every collection to the owning user
            (<code>request.auth.uid == resource.data.user_id</code>).
          </li>
          <li>
            Admin API endpoints are restricted to authorized administrators by both Firebase
            custom claims and server-side <code>require_admin</code> checks.
          </li>
          <li>Rate limiting (60 writes/min/user) prevents abuse.</li>
          <li>We do not store passwords directly — Firebase Auth handles credentials.</li>
        </ul>
        <p className="pt-2">
          No system is 100% secure. If you discover a security issue, please email us before
          public disclosure.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this policy as the App evolves. Material changes will be announced
          in-app and via email. The "Last updated" date at the top reflects the most recent
          revision.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>Questions, requests, or complaints:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Email: [your-email@domain.com]</li>
          <li>Postal: [Your Address]</li>
        </ul>
      </Section>

      <p className="text-xs italic text-ga-text-secondary pt-4">
        This policy was generated from a community template + adapted for GroceryApp's actual
        data practices on 2026-04-26. It is NOT a substitute for review by a qualified attorney
        before public launch.
      </p>
    </LegalLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ga-text-primary mt-6 mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
