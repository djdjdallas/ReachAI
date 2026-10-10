// Dead-man-switch ping for scheduled jobs (healthchecks.io-style URL). The
// external check alerts when pings stop arriving, which catches a cron that
// silently never runs; log lines can't, since a quiet run prints nothing.
//
// Never throws: a heartbeat failure must not break the job it reports on.
// A falsy url (env var unset in preview/dev) is a silent no-op.
export async function pingHeartbeat(url, { fail = false } = {}) {
  if (!url) return;
  try {
    await fetch(`${url}${fail ? "/fail" : ""}`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn("[heartbeat] ping failed:", err?.message);
  }
}
