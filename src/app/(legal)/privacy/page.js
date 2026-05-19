export const metadata = {
  title: "Privacy Policy | Clinchd",
  description: "Clinchd privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: May 19, 2026</p>

        <h2>1. Introduction</h2>
        <p>
          Clinchd (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Clinchd platform
          at clinchd.io. This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you use our service.
        </p>

        <h2>2. Data We Collect from Instagram</h2>
        <p>
          When you connect your Instagram Business account to Clinchd, we access and store
          the following data through the Instagram Graph API:
        </p>

        <h3>Account Information</h3>
        <ul>
          <li>Your Instagram business account ID</li>
          <li>Your Instagram username</li>
          <li>Your business account profile information (name, bio, profile photo)</li>
        </ul>

        <h3>Conversations</h3>
        <ul>
          <li>Direct messages sent to and from your account after connection</li>
          <li>Sender names, profile photos, and Instagram user IDs of people who message you</li>
          <li>Message timestamps and read status</li>
        </ul>

        <h3>Public Comments on Your Posts</h3>
        <ul>
          <li>Public comments left on Instagram posts you have configured for Clinchd review</li>
          <li>The commenter&apos;s username and Instagram user ID</li>
          <li>The text of the comment and timestamp</li>
          <li>The post the comment was left on</li>
        </ul>
        <p>
          We only review comments on posts you have explicitly enabled for Clinchd review.
          We do not access or store comments on posts you have not enabled. You can disable
          comment review for any post at any time from your Clinchd dashboard.
        </p>

        <h3>Why we collect this data</h3>
        <ul>
          <li>To help you respond to inbound DMs and comments faster</li>
          <li>
            To classify the intent of incoming comments using an AI model (e.g., is this
            person interested in your offer, asking a question, or unrelated)
          </li>
          <li>
            To send private replies to commenters when you have configured Clinchd to do so
            on your behalf
          </li>
          <li>
            To provide analytics on conversation outcomes (replies, bookings, qualifications)
          </li>
        </ul>
        <p>
          <strong>Human agent message permission:</strong> Clinchd requests the{" "}
          <code>instagram_business_manage_messages</code> permission, which under Meta&apos;s
          policy allows human agents to send follow-up messages within a 7-day window after
          a user initiates a conversation. This permission is used exclusively to support
          human agent follow-up within the policy-compliant 7-day window.
        </p>
        <p>
          You can disconnect your Instagram account at any time from the Settings page,
          which immediately revokes Clinchd&apos;s access to your Instagram data. Media
          content accessed via Instagram CDN URLs is rendered for display purposes only
          and is not stored or cached on our servers.
        </p>

        <h2>3. Other Information We Collect</h2>

        <h3>Account Information</h3>
        <p>
          When you create an account, we collect your name, email address, and authentication
          credentials. If you sign in via Google, we receive your name, email, and profile
          picture from Google.
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

        <h2>4. AI-Assisted Decision Making</h2>
        <p>
          Clinchd uses AI models to analyze the content of messages and comments to classify
          their intent (e.g., interested lead, question, unrelated). When you configure
          Clinchd to send replies on your behalf, our AI assists in drafting responses using
          your saved sales script and offer information.
        </p>
        <p>You remain in control. You can:</p>
        <ul>
          <li>Pause AI-assisted replies at any time from your dashboard</li>
          <li>Review and override every classification before any reply is sent</li>
          <li>Disable comment review for any post</li>
          <li>
            Disconnect Clinchd from your Instagram account, which immediately stops all
            AI-assisted activity
          </li>
        </ul>

        <h2>5. How We Use Your Information</h2>
        <ul>
          <li>To provide, operate, and maintain the Clinchd platform</li>
          <li>To enable message management and response features on your behalf</li>
          <li>To classify and route inbound messages and comments using AI</li>
          <li>To process transactions and manage your subscription</li>
          <li>To send service-related communications (account alerts, updates)</li>
          <li>To improve our product and develop new features</li>
          <li>To detect and prevent fraud or abuse</li>
        </ul>

        <h2>6. Data Sharing</h2>
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

        <h2>7. Data Retention</h2>
        <p>
          We retain different types of data for different periods, based on what is needed
          to provide the service:
        </p>
        <table>
          <thead>
            <tr>
              <th>Data Type</th>
              <th>Retention Period</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Account and authentication data</td>
              <td>Until you disconnect or delete your account</td>
            </tr>
            <tr>
              <td>Direct message conversations</td>
              <td>Until you delete the conversation or disconnect your account</td>
            </tr>
            <tr>
              <td>Comment classifications</td>
              <td>90 days, then purged on a scheduled basis</td>
            </tr>
            <tr>
              <td>Comment-to-DM dispatch logs</td>
              <td>90 days, then purged on a scheduled basis</td>
            </tr>
            <tr>
              <td>Analytics and aggregated reporting data</td>
              <td>24 months, then deleted</td>
            </tr>
          </tbody>
        </table>
        <p>
          Message content from closed conversations (bookings confirmed or lead marked
          not-a-fit) is deleted after 7 days on a scheduled basis, in line with Meta&apos;s
          messaging retention guidance. Active conversations retain full message history so
          the AI has context for follow-up.
        </p>
        <p>
          When you disconnect your Instagram account or close your Clinchd account, we
          delete all conversation and comment data within 30 days, except where required to
          retain it for legal compliance or fraud prevention.
        </p>

        <h2>8. Data Security</h2>
        <p>
          We use industry-standard security measures including encryption in transit (TLS),
          encryption at rest, and secure authentication. However, no method of electronic
          storage is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2>9. Your Rights and Choices</h2>
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> the data we hold about you
          </li>
          <li>
            <strong>Correct</strong> any inaccurate data
          </li>
          <li>
            <strong>Delete</strong> your data (see below)
          </li>
          <li>
            <strong>Disconnect</strong> Clinchd from your Instagram or Google Calendar
            account at any time
          </li>
          <li>
            <strong>Object</strong> to AI-assisted processing of your messages and comments
          </li>
          <li>
            <strong>Export</strong> your data
          </li>
        </ul>

        <h3>Data Deletion Requests</h3>
        <p>
          If you are a coach using Clinchd, you can delete your account and all associated
          data from your dashboard at any time.
        </p>
        <p>
          If you are a person whose comment or message was processed by Clinchd (for
          example, you commented on a coach&apos;s post and received a reply), you can
          request that we delete data about you by submitting a request at:
        </p>
        <p>
          <strong>
            <a href="/data-deletion">https://www.clinchd.io/data-deletion</a>
          </strong>
        </p>
        <p>We will respond to deletion requests within 30 days.</p>

        <h2>10. Cookies</h2>
        <p>
          We use essential cookies for authentication and session management. We use
          analytics cookies (PostHog) to understand how the product is used. You can
          disable non-essential cookies in your browser settings.
        </p>

        <h2>11. Children&apos;s Privacy</h2>
        <p>
          Clinchd is not intended for use by anyone under the age of 18. We do not
          knowingly collect personal information from children.
        </p>

        <h2>12. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of
          material changes by posting the updated policy on this page and updating the
          &quot;Last updated&quot; date.
        </p>

        <h2>13. Contact</h2>
        <p>
          For privacy questions or to exercise your rights under this policy, contact us at{" "}
          <a href="mailto:privacy@clinchd.io">privacy@clinchd.io</a> or{" "}
          <a href="mailto:support@clinchd.com">support@clinchd.com</a>.
        </p>
      </div>
    </div>
  );
}
