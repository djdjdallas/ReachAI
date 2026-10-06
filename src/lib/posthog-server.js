import { PostHog } from "posthog-node";

// Server-side analytics. Analytics is a side effect: it must never throw
// into, block, or fail the code that calls it (the Stripe and Instagram
// webhooks above all, where a throw is a 500 and a retry storm, or a
// dropped DM).
//
// getPostHogClient() returns a wrapper, never the raw SDK client:
// - No NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: a no-op client (logged once).
//   The SDK constructor throws without a key; that throw used to surface
//   as a 500 from checkout.session.completed.
// - Every method is individually try/caught and logged. Async methods
//   (captureImmediate, flush, shutdown) never reject and give up after
//   ANALYTICS_TIMEOUT_MS, so a PostHog outage can't hang a request.
// The SDK already catches its own background-flush errors.

export const ANALYTICS_TIMEOUT_MS = 3000;

const SYNC_METHODS = ["capture", "identify", "alias", "groupIdentify"];
const ASYNC_METHODS = ["captureImmediate", "flush", "shutdown"];

let client = null;
let warnedNoKey = false;

function logFailure(method, err, args) {
  const event = args?.[0]?.event;
  console.error(`[analytics] ${method}${event ? ` ${event}` : ""} failed:`, err?.message || err);
}

function withTimeout(promise, method, args) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      logFailure(method, new Error(`timed out after ${ANALYTICS_TIMEOUT_MS}ms`), args);
      resolve(undefined);
    }, ANALYTICS_TIMEOUT_MS);
  });
  return Promise.race([
    Promise.resolve(promise).then(
      (v) => v,
      (err) => {
        logFailure(method, err, args);
        return undefined;
      }
    ),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

/**
 * Wrap a PostHog-like client so no method can throw or reject. Exported for
 * tests; callers use getPostHogClient().
 * @param {object|null} raw - posthog-node client, or null for a no-op
 */
export function safeAnalyticsClient(raw) {
  const safe = {};
  for (const method of SYNC_METHODS) {
    safe[method] = (...args) => {
      if (!raw) return undefined;
      try {
        return raw[method](...args);
      } catch (err) {
        logFailure(method, err, args);
        return undefined;
      }
    };
  }
  for (const method of ASYNC_METHODS) {
    safe[method] = (...args) => {
      if (!raw) return Promise.resolve(undefined);
      try {
        return withTimeout(raw[method](...args), method, args);
      } catch (err) {
        logFailure(method, err, args);
        return Promise.resolve(undefined);
      }
    };
  }
  return safe;
}

export function getPostHogClient() {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  let raw = null;
  if (!key) {
    if (!warnedNoKey) {
      console.warn("[analytics] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN not set; server analytics disabled");
      warnedNoKey = true;
    }
  } else {
    try {
      raw = new PostHog(key, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0,
      });
    } catch (err) {
      console.error("[analytics] PostHog client init failed, analytics disabled:", err?.message);
      raw = null;
    }
  }
  client = safeAnalyticsClient(raw);
  return client;
}
