export const metadata = {
  title: "Data Deletion Request | Clinchd",
  description: "Request deletion of data Clinchd holds about you.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Data Deletion Request</h1>
        <p className="text-muted-foreground">Last updated: May 19, 2026</p>

        <p className="lead">
          Clinchd is committed to giving you control over your data. Use this page to
          request deletion of data we hold about you.
        </p>

        <h2>If you&apos;re a Clinchd customer</h2>
        <p>
          You can delete your account and all associated data directly from your dashboard:
        </p>
        <ol>
          <li>
            Sign in to your <a href="/dashboard">Clinchd dashboard</a>
          </li>
          <li>Go to Settings &rarr; Account</li>
          <li>Click &quot;Delete account&quot;</li>
        </ol>
        <p>
          This will immediately disconnect your Instagram account and queue all associated
          conversation and comment data for permanent deletion within 30 days.
        </p>

        <h2>If you&apos;re not a Clinchd customer</h2>
        <p>
          If you commented on a Clinchd customer&apos;s post or messaged their Instagram
          account and want us to delete data we hold about you, email{" "}
          <a href="mailto:privacy@clinchd.io">privacy@clinchd.io</a> with:
        </p>
        <ul>
          <li>Your Instagram username</li>
          <li>
            The Clinchd customer&apos;s Instagram username (whose post or inbox you
            interacted with)
          </li>
          <li>A brief description of the data you&apos;d like deleted</li>
        </ul>
        <p>We will respond within 30 days and confirm when deletion is complete.</p>

        <h2>Data we delete on request</h2>
        <ul>
          <li>Your Instagram username and user ID, if stored</li>
          <li>Direct messages exchanged with the Clinchd customer&apos;s account</li>
          <li>Comments you made on the Clinchd customer&apos;s posts</li>
          <li>Classification results and dispatch logs related to your interactions</li>
        </ul>

        <h2>Data we cannot delete</h2>
        <p>
          Some data may be retained where required by law, for fraud prevention, or for
          legitimate aggregate analytics where individual records have already been
          anonymized.
        </p>

        <h2>Questions</h2>
        <p>
          Email <a href="mailto:privacy@clinchd.io">privacy@clinchd.io</a> with any
          questions about data deletion or our privacy practices. For general support, you
          can also reach us at{" "}
          <a href="mailto:support@clinchd.com">support@clinchd.com</a>.
        </p>
      </div>
    </div>
  );
}
