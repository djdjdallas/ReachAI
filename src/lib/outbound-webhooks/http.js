// One HTTPS POST to a webhook destination. No redirects (node:https never
// follows them; a 3xx is a failed attempt), 10s hard deadline covering DNS,
// connect, TLS and response, and at most MAX_RESPONSE_BYTES of the response
// read. The connection goes only to addresses safeLookup checked.

import https from "node:https";
import { parseDestinationUrl, safeLookup, SsrfError } from "./ssrf";

export const TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 4096;

/**
 * @param {{url: string, body: string, headers: Record<string,string>, timeoutMs?: number, request?: Function}} args
 * @returns {Promise<{ok: boolean, status: number|null, error: string|null}>}
 *   Never throws. error is a short code, never response content.
 */
export async function postWebhook({ url, body, headers, timeoutMs = TIMEOUT_MS, request = https.request }) {
  let target;
  try {
    target = parseDestinationUrl(url);
  } catch (err) {
    return { ok: false, status: null, error: err instanceof SsrfError ? err.code : "url_invalid" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(r);
    };

    const req = request(
      target,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        lookup: safeLookup,
        agent: false,
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode || null;
        let read = 0;
        res.on("data", (chunk) => {
          read += chunk.length;
          if (read > MAX_RESPONSE_BYTES) res.destroy();
        });
        const finish = () =>
          done({
            ok: status >= 200 && status < 300,
            status,
            error: status >= 300 && status < 400 ? "redirect_not_followed" : null,
          });
        res.on("end", finish);
        res.on("close", finish);
        res.on("error", finish);
      }
    );

    const deadline = setTimeout(() => {
      req.destroy(new Error("timeout"));
      done({ ok: false, status: null, error: "timeout" });
    }, timeoutMs);

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err) => {
      const code =
        err instanceof SsrfError
          ? err.code
          : err?.message === "timeout"
            ? "timeout"
            : String(err?.code || "network_error").toLowerCase();
      done({ ok: false, status: null, error: code });
    });
    req.end(body);
  });
}
