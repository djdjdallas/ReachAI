// SSRF guard for outbound webhook destinations. Applied when a destination
// is configured AND on every delivery:
//   - https only, default port only, no credentials in the URL
//   - IP-literal hosts are checked directly; hostnames are resolved and
//     EVERY address must be public. The request then connects to the
//     address that was checked (see safeLookup), so a DNS answer that
//     changes between check and connect can't redirect the request.
//   - IPv4-mapped / NAT64 / 6to4 IPv6 forms are unwrapped and checked as
//     the IPv4 address they carry.
// Redirects are never followed and the response read is capped (http.js).

import net from "node:net";
import dns from "node:dns";

const V4_BLOCKED = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
];

const v4List = new net.BlockList();
for (const [addr, prefix] of V4_BLOCKED) v4List.addSubnet(addr, prefix, "ipv4");

/** "::ffff:1.2.3.4" / "2001:db8::1" → 8 numeric hextets, or null. */
function expandV6(addr) {
  let s = String(addr).toLowerCase().split("%")[0];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    if (net.isIPv4(dotted[1]) === false) return null;
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    s = s.slice(0, -dotted[1].length) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const parts = [...head, ...Array(fill).fill("0"), ...tail];
  if (parts.length !== 8) return null;
  const nums = parts.map((p) => (/^[0-9a-f]{1,4}$/.test(p) ? parseInt(p, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

const v4FromHextets = (h1, h2) => `${h1 >> 8}.${h1 & 255}.${h2 >> 8}.${h2 & 255}`;

/**
 * True when the address must never be a webhook destination.
 *
 * @param {string} address - IPv4 or IPv6 literal
 * @returns {boolean}
 */
export function isBlockedAddress(address) {
  const addr = String(address || "").replace(/^\[|\]$/g, "");
  if (net.isIPv4(addr)) return v4List.check(addr, "ipv4");
  if (!net.isIPv6(addr)) return true; // not an IP at all: refuse
  const h = expandV6(addr);
  if (!h) return true;
  // ::/96 (unspecified, loopback, deprecated IPv4-compatible) and
  // ::ffff:0:0/96 (IPv4-mapped): judge the embedded IPv4 address, but the
  // compatible range is never a real destination.
  if (h.slice(0, 5).every((x) => x === 0)) {
    if (h[5] === 0xffff) return isBlockedAddress(v4FromHextets(h[6], h[7]));
    return true;
  }
  // NAT64 64:ff9b::/96 and 6to4 2002::/16 carry an IPv4 address.
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) {
    return isBlockedAddress(v4FromHextets(h[6], h[7]));
  }
  if (h[0] === 0x2002) return isBlockedAddress(v4FromHextets(h[1], h[2]));
  // Only global unicast (2000::/3) is allowed. That excludes fc00::/7
  // (unique local), fe80::/10 (link-local), ff00::/8 (multicast) and every
  // other special range outside 2000::/3.
  if ((h[0] & 0xe000) !== 0x2000) return true;
  // Inside 2000::/3: documentation (2001:db8::/32), ORCHID/benchmarking
  // and Teredo (2001::/23 IETF protocol assignments).
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true;
  if (h[0] === 0x2001 && h[1] < 0x0200) return true;
  return false;
}

export class SsrfError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/**
 * Static checks on a destination URL (no DNS). Throws SsrfError.
 *
 * @param {string} raw
 * @returns {URL}
 */
export function parseDestinationUrl(raw) {
  const s = String(raw || "").trim();
  if (s.length > 2048) throw new SsrfError("url_too_long");
  let url;
  try {
    url = new URL(s);
  } catch {
    throw new SsrfError("url_invalid");
  }
  if (url.protocol !== "https:") throw new SsrfError("https_required");
  if (url.username || url.password) throw new SsrfError("credentials_not_allowed");
  if (url.port && url.port !== "443") throw new SsrfError("port_not_allowed");
  if (url.hash) throw new SsrfError("fragment_not_allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) throw new SsrfError("url_invalid");
  if (net.isIP(host) && isBlockedAddress(host)) throw new SsrfError("address_blocked");
  if (!net.isIP(host) && (host === "localhost" || host.endsWith(".localhost") || !host.includes("."))) {
    throw new SsrfError("address_blocked");
  }
  return url;
}

/**
 * Resolve a hostname and require every address to be public.
 *
 * @param {string} hostname
 * @param {(host: string, opts: object) => Promise<Array<{address: string, family: number}>>} [lookupAll]
 * @returns {Promise<Array<{address: string, family: number}>>}
 */
export async function resolvePublic(hostname, lookupAll = (h, o) => dns.promises.lookup(h, o)) {
  const host = String(hostname).replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new SsrfError("address_blocked");
    return [{ address: host, family: net.isIP(host) }];
  }
  let addrs;
  try {
    addrs = await lookupAll(host, { all: true, verbatim: true });
  } catch (err) {
    throw new SsrfError("dns_failed", err?.code || "dns_failed");
  }
  if (!addrs?.length) throw new SsrfError("dns_failed");
  if (addrs.some((a) => isBlockedAddress(a.address))) throw new SsrfError("address_blocked");
  return addrs;
}

/**
 * Full config-time check: static rules plus DNS.
 *
 * @param {string} raw
 * @returns {Promise<URL>}
 */
export async function assertSafeDestination(raw, lookupAll) {
  const url = parseDestinationUrl(raw);
  await resolvePublic(url.hostname, lookupAll);
  return url;
}

/**
 * A `lookup` for http(s).request: resolves, checks every address, and hands
 * the socket only checked addresses. Node skips lookup for IP-literal
 * hosts, which parseDestinationUrl has already checked.
 */
export function safeLookup(hostname, options, callback) {
  const opts = typeof options === "object" && options ? options : {};
  resolvePublic(hostname)
    .then((addrs) => {
      const family = opts.family === 4 || opts.family === 6 ? opts.family : 0;
      const usable = family ? addrs.filter((a) => a.family === family) : addrs;
      if (!usable.length) return callback(new SsrfError("dns_failed"));
      if (opts.all) return callback(null, usable);
      return callback(null, usable[0].address, usable[0].family);
    })
    .catch((err) => callback(err));
}
