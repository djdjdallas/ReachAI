export const metadata = {
  title: "Terms of Service | Clinchd",
  description: "Clinchd terms of service — the rules and guidelines for using our platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: March 27, 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Clinchd (&quot;the Service&quot;), operated by Clinchd
          (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), you agree to be bound by
          these Terms of Service. If you do not agree to these terms, do not use the Service.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          Clinchd is an AI-powered platform that automates Instagram direct message responses
          for businesses. The Service uses artificial intelligence to qualify leads, handle
          objections, and guide prospects through a sales conversation on your behalf.
        </p>

        <h2>3. Account Registration</h2>
        <ul>
          <li>You must be at least 18 years old to use the Service.</li>
          <li>You must provide accurate and complete registration information.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You must notify us immediately of any unauthorized use of your account.</li>
        </ul>

        <h2>4. Instagram Integration</h2>
        <p>By connecting your Instagram account, you:</p>
        <ul>
          <li>
            Authorize Clinchd to read and respond to direct messages on your behalf.
          </li>
          <li>
            Confirm that you have the authority to connect the Instagram account and
            authorize automated responses.
          </li>
          <li>
            Agree to comply with Instagram&apos;s Terms of Use and Community Guidelines.
          </li>
          <li>
            Understand that Clinchd only responds to messages initiated by other users and
            does not send unsolicited outreach.
          </li>
        </ul>

        <h2>5. AI-Generated Content</h2>
        <p>
          The Service generates AI-powered responses based on your script configuration.
          You acknowledge that:
        </p>
        <ul>
          <li>AI-generated responses may not always be perfectly accurate or appropriate.</li>
          <li>
            You are ultimately responsible for the content sent from your Instagram account,
            including AI-generated messages.
          </li>
          <li>
            You should review and test your AI script configuration before activating
            automated responses.
          </li>
          <li>
            You can pause or deactivate AI responses at any time from your dashboard.
          </li>
        </ul>

        <h2>6. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>Send spam, unsolicited messages, or engage in harassment.</li>
          <li>Violate any applicable laws, regulations, or third-party rights.</li>
          <li>Impersonate another person or entity.</li>
          <li>Distribute malware, viruses, or harmful content.</li>
          <li>Attempt to gain unauthorized access to the Service or its systems.</li>
          <li>Use the Service for any illegal or fraudulent activity.</li>
          <li>
            Make false or misleading claims about products or services in your AI script.
          </li>
        </ul>

        <h2>7. Subscription and Billing</h2>
        <ul>
          <li>
            The Service is offered on a subscription basis with pricing as displayed on
            our website.
          </li>
          <li>
            Subscriptions renew automatically unless cancelled before the renewal date.
          </li>
          <li>All payments are processed securely through Stripe.</li>
          <li>
            Refunds are handled on a case-by-case basis. Contact support@clinchd.com for
            refund requests.
          </li>
          <li>
            We reserve the right to change pricing with 30 days&apos; notice to existing
            subscribers.
          </li>
        </ul>

        <h2>8. DM Limits</h2>
        <p>
          Your subscription plan includes a monthly limit on AI-generated DM responses.
          Once the limit is reached, AI responses will be paused until the next billing
          cycle. You can monitor your usage from the dashboard.
        </p>

        <h2>9. Intellectual Property</h2>
        <p>
          The Clinchd platform, including its design, code, and AI models, is owned by us
          and protected by intellectual property laws. Your script configurations, voice
          profiles, and business content remain your property.
        </p>

        <h2>10. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Clinchd shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, including but
          not limited to loss of revenue, lost profits, or loss of business opportunities,
          arising from your use of the Service.
        </p>
        <p>
          We are not liable for any actions taken by Instagram regarding your account,
          including account suspension or restriction, that may result from the use of
          automated messaging.
        </p>

        <h2>11. Disclaimer of Warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, either express or implied. We do not guarantee that AI
          responses will result in sales conversions, lead qualification, or any specific
          business outcome.
        </p>

        <h2>12. Termination</h2>
        <p>
          We reserve the right to suspend or terminate your account at any time for
          violation of these Terms. You may cancel your account at any time through your
          account settings or by contacting support@clinchd.com.
        </p>

        <h2>13. Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify you of material
          changes via email or through the Service. Continued use of the Service after
          changes constitutes acceptance of the updated Terms.
        </p>

        <h2>14. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of
          the United States. Any disputes arising under these Terms shall be resolved
          through binding arbitration.
        </p>

        <h2>15. Contact Us</h2>
        <p>
          If you have questions about these Terms of Service, contact us at{" "}
          <a href="mailto:support@clinchd.com">support@clinchd.com</a>.
        </p>
      </div>
    </div>
  );
}
