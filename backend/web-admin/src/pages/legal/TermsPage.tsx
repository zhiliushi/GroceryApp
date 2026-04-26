import LegalLayout from './LegalLayout';

/**
 * Terms of Service — mirrors docs/legal/terms-of-service.md.
 * If you change this file, also update the markdown source.
 */
export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="2026-04-26">
      <Section title="1. Acceptance">
        <p>
          By creating an account or using GroceryApp ("the Service"), you agree to these Terms
          of Service. If you do not agree, do not use the Service.
        </p>
      </Section>

      <Section title="2. The Service">
        <p>
          GroceryApp helps users track grocery purchases, monitor expiry dates, and reduce food
          waste. The Service is currently in <strong>invite-only beta</strong> and is provided{' '}
          <strong>free of charge</strong> during this period. Features and availability may
          change without notice.
        </p>
      </Section>

      <Section title="3. Eligibility">
        <p>
          You must be at least 13 years old. By using the Service, you represent that you meet
          this requirement and that any information you provide is accurate.
        </p>
      </Section>

      <Section title="4. Account responsibilities">
        <ul className="list-disc pl-6 space-y-1">
          <li>You are responsible for keeping your sign-in credentials (Google Account) secure.</li>
          <li>You may not share your account with others. One person, one account.</li>
          <li>You must notify us promptly of any unauthorized use.</li>
          <li>We may suspend or terminate accounts that violate these terms or applicable law.</li>
        </ul>
      </Section>

      <Section title="5. Acceptable use">
        <p>You agree NOT to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Reverse-engineer, decompile, or attempt to extract source code.</li>
          <li>Probe for vulnerabilities other than as part of responsible disclosure.</li>
          <li>Submit illegal content, infringing content, or content that violates others' privacy.</li>
          <li>Use the Service to send unsolicited messages.</li>
          <li>Abuse rate limits or attempt to circumvent quotas.</li>
          <li>Use automated scrapers to extract other users' data.</li>
        </ul>
      </Section>

      <Section title="6. Your content">
        <p>
          You retain ownership of the inventory data, recipes, and other content you add to the
          App. By submitting content, you grant us a limited license to store, process, and
          display it back to you as needed to provide the Service. We do not claim ownership
          and do not use your content to train third-party AI models.
        </p>
        <p>
          You are responsible for the accuracy of expiry dates and other inventory data you
          enter. We provide reminders and computed metrics as informational aids only — they
          are not guarantees of food safety.
        </p>
      </Section>

      <Section title="7. Service availability">
        <p>The Service is provided "as is" and "as available." During beta:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>We do not commit to any specific uptime.</li>
          <li>We may restart, modify, or remove features without notice.</li>
          <li>
            Data loss, while we work to prevent it, can happen during beta. Export your data
            periodically (Settings → Export Data) if it matters.
          </li>
        </ul>
      </Section>

      <Section title="8. Disclaimers">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>No warranty.</strong> The Service is provided WITHOUT warranties of any
            kind, express or implied, including merchantability, fitness for a particular
            purpose, and non-infringement.
          </li>
          <li>
            <strong>Food safety.</strong> GroceryApp is a tracking aid, NOT a food-safety
            oracle. Expiry dates are user-entered and may be wrong. NEVER rely solely on the
            App to decide whether food is safe to eat. When in doubt, throw it out.
          </li>
          <li>
            <strong>No medical / dietary advice.</strong> Information shown by the App is not
            medical, nutritional, or allergy advice.
          </li>
          <li>
            <strong>Third-party data.</strong> Barcode lookups use OpenFoodFacts and similar
            community databases. Their accuracy is not guaranteed.
          </li>
        </ul>
      </Section>

      <Section title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, the operator and its affiliates are not
          liable for:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Indirect, incidental, special, consequential, or punitive damages</li>
          <li>Lost profits, lost data, or business interruption</li>
          <li>Any claim related to food spoilage, illness, or other consumption-related outcomes</li>
        </ul>
        <p className="pt-2">
          If liability cannot be excluded, our total cumulative liability is limited to the
          amount you have paid us in the past 12 months (currently zero, as the beta is free).
        </p>
      </Section>

      <Section title="10. Termination">
        <p>
          You may stop using the Service at any time and delete your account in Settings. We
          may suspend or terminate access if you violate these Terms or applicable law. After
          termination, your data is deleted per the Privacy Policy.
        </p>
      </Section>

      <Section title="11. Changes">
        <p>
          We may update these Terms as the Service evolves. Material changes will be announced
          in-app and via email. Continued use after a change constitutes acceptance.
        </p>
      </Section>

      <Section title="12. Governing law">
        <p>
          These Terms are governed by the laws of Malaysia. Disputes shall be resolved in the
          courts of [State/Federal Territory].
        </p>
      </Section>

      <Section title="13. Contact">
        <p>Questions about these Terms:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Email: [your-email@domain.com]</li>
          <li>Postal: [Your Address]</li>
        </ul>
      </Section>

      <p className="text-xs italic text-ga-text-secondary pt-4">
        This document was generated from a community template + adapted for GroceryApp on
        2026-04-26. It is NOT a substitute for review by a qualified attorney before public
        launch.
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
