export const metadata = {
  title: "Privacy Policy | Clinchd",
  description: "Clinchd privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: April 13, 2026</p>

        <h2>1. Introduction</h2>
        <p>
          Clinchd (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Clinchd platform
          at clinchd.io. This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you use our service.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>Account Information</h3>
        <p>
          When you create an account, we collect your name, email address, and authentication
          credentials. If you sign in via Google, we receive your name, email, and profile
          picture from Google.
        </p>
        <h3>Instagram Data</h3>
        <p>
          When you connect your Instagram account, we collect your Instagram account ID,
          username, profile information, and the content of direct messages sent to and
          from your account. This data is accessed solely to provide shared-inbox
          functionality and AI-assisted reply features within Clinchd. Message data is
          never stored beyond what is necessary for conversation context and is not used
          for any purpose other than operating the service you have explicitly connected.
        </p>
        <p>
          <strong>Human agent message permission:</strong> Clinchd requests the
          <code> instagram_business_manage_messages </code> permission, which under Meta&apos;s
          policy allows human agents to send follow-up messages within a 7-day window after
          a user initiates a conversation. This permission is used exclusively to support
          human agent follow-up within the policy-compliant 7-day window. AI-assisted replies
          operate under Meta&apos;s standard 24-hour messaging window and conversation-initiation
          rules, and the account owner is in control of when the AI is enabled.
        </p>
        <p>
          You can disconnect your Instagram account at any time from the Settings page,
          which immediately revokes Clinchd&apos;s access to your Instagram data.
        </p>
        <h3>Google Calendar Data</h3>
        <p>
          When you connect your Google Calendar account, Clinchd requests
          <strong> read-only </strong> access to your calendar events. This data is used
          solely to display your scheduled calls and appointments within the Clinchd
          dashboard. Google Calendar data is fetched on demand and is not stored on our
          servers beyond the active session. We do not share, sell, or transfer your
          Google Calendar data to any third party. You can disconnect your Google Calendar
          at any time from the Settings page, which immediately revokes Clinchd&apos;s
          access to your calendar data.
        </p>

        <h3>Usage Data</h3>
        <p>
          We collect anonymized usage analytics (via PostHog) to improve the product. This
          includes page views, feature usage, and session data. We do not sell this data to
          third parties.
        </p>
        <h3>Payment Information</h3>
        <p>
          Payment processing is handled by Stripe. We do not store your credit card numbers
          or full payment details on our servers. Stripe&apos;s privacy policy governs the
          handling of your payment information.
        </p>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To provide, operate, and maintain the Clinchd platform</li>
          <li>To generate AI-assisted DM replies on your behalf</li>
          <li>To process transactions and manage your subscription</li>
          <li>To send service-related communications (account alerts, updates)</li>
          <li>To improve our product and develop new features</li>
          <li>To detect and prevent fraud or abuse</li>
        </ul>

        <h2>4. Data Sharing</h2>
        <p>We do not sell your personal data. We share information only with:</p>
        <ul>
          <li>
            <strong>Service providers:</strong> Anthropic (AI processing), Google (calendar
            integration), Stripe (payments), Supabase (database hosting), Meta (Instagram
            Graph API for messaging), Resend (transactional email), Twilio (SMS alerts),
            Vercel (hosting), and PostHog (analytics).
          </li>
          <li>
            <strong>Legal requirements:</strong> When required by law, subpoena, or
            governmental request.
          </li>
        </ul>

        <h2>5. Data Retention</h2>
        <p>
          We retain your account data for as long as your account is active. Message
          content from closed conversations (bookings confirmed or lead marked not-a-fit)
          is automatically deleted after 7 days, in line with Meta&apos;s messaging retention
          guidance. Active conversations retain full message history so the AI has context
          for follow-up. You can request full deletion of any conversation at any time.
          If you delete your account, we will remove your personal data within 30 days.
        </p>

        <h2>6. Data Security</h2>
        <p>
          We use industry-standard security measures including encryption in transit (TLS),
          encryption at rest, and secure authentication. However, no method of electronic
          storage is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Disconnect your Instagram or Google Calendar accounts at any time</li>
          <li>Export your data</li>
        </ul>

        <h2>8. Cookies</h2>
        <p>
          We use essential cookies for authentication and session management. We use
          analytics cookies (PostHog) to understand how the product is used. You can
          disable non-essential cookies in your browser settings.
        </p>

        <h2>9. Children&apos;s Privacy</h2>
        <p>
          Clinchd is not intended for use by anyone under the age of 18. We do not
          knowingly collect personal information from children.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of
          material changes by posting the updated policy on this page and updating the
          &quot;Last updated&quot; date.
        </p>

        <h2>11. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or your data, contact us at{" "}
          <a href="mailto:support@clinchd.com">support@clinchd.com</a>.
        </p>
      </div>
    </div>
  );
}
