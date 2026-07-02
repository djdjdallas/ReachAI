// SSRF-hardened fetch for the Import Offer feature. Server-side only.
//
// Guarantees:
//   - https:// only, default port only, no embedded credentials
//   - Every address the socket actually dials is validated against
//     private/loopback/link-local/multicast ranges. Validation happens inside
//     a custom `lookup` passed to node:https, so the checked address IS the
//     connected address — a DNS answer that changes between check and connect
//     (rebinding) cannot slip through.
//   - Redirects capped at MAX_REDIRECTS; every hop re-validated from scratch
//   - Single wall-clock deadline (FETCH_TIMEOUT_MS) across all hops + body
//   - Body capped at MAX_RESPONSE_BYTES; oversized responses are aborted
//   - Only ALLOWED_CONTENT_TYPES are read; other bodies are never consumed

import { request as httpsRequest } from "node:https";
import dns from "node:dns";
import net from "node:net";
import {
  ALLOWED_CONTENT_TYPES,
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
} from "./import-schema";

const USER_AGENT = "Clinchd/1.0 (offer import; +https://clinchd.io)";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Error with a stable machine-readable `code` and a user-safe `message`.
 * Route handlers can surface `message` directly.
 */
export class SafeFetchError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

function blockedErr() {
  return new SafeFetchError(
    "That URL points to a private or internal address and can't be used.",
    "EBLOCKED"
  );
}

function timeoutErr() {
  return new SafeFetchError(
    "The page took too long to respond. Try again, or fill in the fields manually.",
    "ETIMEDOUT"
  );
}

// ── Address validation ─────────────────────────────────────────────────────

function isBlockedIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // malformed: block
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 (includes 0.0.0.0)
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/**
 * Expands an IPv6 string (possibly `::`-compressed) into 8 16-bit groups.
 * Returns null if it can't be parsed. Any embedded dotted-IPv4 tail is
 * folded into the last two groups. Callers should gate on net.isIPv6 first,
 * but this stays defensive regardless.
 */
function expandIPv6(ip) {
  let s = ip.toLowerCase();
  // Fold a trailing dotted-IPv4 (e.g. ::ffff:127.0.0.1) into two hex groups.
  const v4 = s.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const o = v4.slice(1).map(Number);
    if (o.some((n) => n > 255)) return null;
    const g6 = ((o[0] << 8) | o[1]).toString(16);
    const g7 = ((o[2] << 8) | o[3]).toString(16);
    s = s.slice(0, v4.index) + `${g6}:${g7}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [
    ...head,
    ...Array(halves.length === 2 ? fill : 0).fill("0"),
    ...tail,
  ];
  if (groups.length !== 8) return null;
  const out = groups.map((g) => (g === "" ? 0 : parseInt(g, 16)));
  if (out.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
  return out;
}

/**
 * Returns true when `ip` must never be connected to. Unknown formats are
 * blocked (fail closed).
 *
 * Note on IPv6: the WHATWG URL parser normalizes IPv4-mapped literals to the
 * hex-hextet form (`[::ffff:127.0.0.1]` -> `::ffff:7f00:1`), so matching a
 * dotted-decimal tail is not enough — we expand to numeric groups and decode
 * every IPv4-embedding form before range-checking.
 */
export function isBlockedAddress(ip) {
  if (typeof ip !== "string" || !ip) return true;
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip)) {
    const g = expandIPv6(ip);
    if (!g) return true; // unparseable: fail closed

    const isZero = (from, to) => g.slice(from, to).every((x) => x === 0);
    const embeddedV4 = () =>
      [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff].join(".");

    if (isZero(0, 8)) return true; // :: unspecified
    if (isZero(0, 7) && g[7] === 1) return true; // ::1 loopback
    // IPv4-mapped (::ffff:x.x) and IPv4-compatible (::x.x) — decode + validate.
    if (isZero(0, 5) && g[5] === 0xffff) return isBlockedIPv4(embeddedV4());
    if (isZero(0, 6)) return isBlockedIPv4(embeddedV4()); // ::x.x compatible
    if (g[0] === 0x64 && g[1] === 0xff9b) return isBlockedIPv4(embeddedV4()); // NAT64 64:ff9b::/96
    if (g[0] === 0x2002) return isBlockedIPv4([g[1] >> 8, g[1] & 0xff, g[2] >> 8, g[2] & 0xff].join(".")); // 6to4
    if (g[0] === 0x2001 && g[1] === 0x0000) return true; // Teredo 2001::/32 (embeds IPv4 — block wholesale)

    if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    return false;
  }
  return true;
}

/**
 * dns.lookup wrapper handed to node:https. Resolves ALL addresses, rejects
 * the connection if any resolved address is blocked, otherwise returns the
 * first address — which is exactly the address net.connect will dial.
 */
function safeLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [addresses];
    if (list.length === 0) {
      return callback(new SafeFetchError("That domain could not be resolved.", "ENOTFOUND"));
    }
    if (list.some((entry) => isBlockedAddress(entry && entry.address))) {
      return callback(blockedErr());
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

// ── URL validation (repeated on every redirect hop) ────────────────────────

function validateHopUrl(url) {
  if (url.protocol !== "https:") {
    throw new SafeFetchError("Only https:// links are supported.", "EPROTOCOL");
  }
  if (url.username || url.password) {
    throw new SafeFetchError(
      "Links with embedded credentials are not supported.",
      "ECREDENTIALS"
    );
  }
  if (url.port && url.port !== "443") {
    throw new SafeFetchError(
      "Only the standard https port is supported.",
      "EPORT"
    );
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) {
    throw new SafeFetchError("That doesn't look like a valid link.", "EINVALID");
  }
  // Literal-IP URLs bypass dns.lookup, so validate them here directly.
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw blockedErr();
  }
  return host;
}

// ── Request plumbing ───────────────────────────────────────────────────────

function requestOnce(url, host, deadline) {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(timeoutErr());

    const req = httpsRequest(
      {
        host,
        servername: net.isIP(host) ? undefined : host,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        lookup: safeLookup,
        headers: {
          Host: url.hostname,
          "User-Agent": USER_AGENT,
          Accept: "text/html,text/plain;q=0.9",
          "Accept-Language": "en",
        },
      },
      (res) => {
        clearTimeout(timer);
        resolve(res);
      }
    );

    const timer = setTimeout(() => {
      req.destroy(timeoutErr());
    }, remaining);

    req.once("error", (err) => {
      clearTimeout(timer);
      reject(
        err instanceof SafeFetchError
          ? err
          : new SafeFetchError("That page could not be reached.", "ECONNECT")
      );
    });
    req.end();
  });
}

function readBody(res, deadline) {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      res.destroy();
      return reject(timeoutErr());
    }
    const chunks = [];
    let total = 0;
    const timer = setTimeout(() => {
      res.destroy();
      reject(timeoutErr());
    }, remaining);

    res.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_RESPONSE_BYTES) {
        clearTimeout(timer);
        res.destroy();
        reject(
          new SafeFetchError(
            "That page is too large to import. Try a simpler page.",
            "ETOOLARGE"
          )
        );
        return;
      }
      chunks.push(chunk);
    });
    res.once("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    res.once("error", (err) => {
      clearTimeout(timer);
      reject(
        err instanceof SafeFetchError
          ? err
          : new SafeFetchError("The connection dropped while reading the page.", "EREAD")
      );
    });
  });
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Fetches a user-supplied URL with the hardening described at the top of
 * this file. Throws SafeFetchError with a user-safe message on any failure.
 *
 * @param {string} rawUrl
 * @returns {Promise<{ text: string, finalUrl: string, contentType: string }>}
 */
export async function safeFetchText(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new SafeFetchError("That doesn't look like a valid link.", "EINVALID");
  }

  const deadline = Date.now() + FETCH_TIMEOUT_MS;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const host = validateHopUrl(url);
    const res = await requestOnce(url, host, deadline);

    if (REDIRECT_STATUSES.has(res.statusCode)) {
      res.resume(); // discard the redirect body
      const location = res.headers.location;
      if (!location) {
        throw new SafeFetchError("The page redirected without a destination.", "EREDIRECT");
      }
      try {
        url = new URL(location, url); // re-validated at the top of the loop
      } catch {
        throw new SafeFetchError("The page redirected to an invalid link.", "EREDIRECT");
      }
      continue;
    }

    if (res.statusCode !== 200) {
      res.resume();
      throw new SafeFetchError(
        `The page responded with status ${res.statusCode}.`,
        "ESTATUS"
      );
    }

    const contentType = String(res.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      res.destroy();
      throw new SafeFetchError(
        "Only regular web pages can be imported (not PDFs, images, or files).",
        "ECONTENTTYPE"
      );
    }

    const declaredLength = Number(res.headers["content-length"]);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      res.destroy();
      throw new SafeFetchError(
        "That page is too large to import. Try a simpler page.",
        "ETOOLARGE"
      );
    }

    const text = await readBody(res, deadline);
    return { text, finalUrl: url.toString(), contentType };
  }

  throw new SafeFetchError("The page redirected too many times.", "EREDIRECTS");
}
