// Leaf module, no imports. bookingLinkFor picks the link an account sends;
// normalizeBookingUrl normalizes the booking link (users.calendly_url)
// before a browser save, to match the users_calendly_url_check constraint
// (migration 20261005150000): null, or https:// and at most 500 characters.
//
// Blank becomes null, http:// becomes https://, and a bare
// "calendly.com/name" gets https:// in front, so ordinary input still saves.

export const BOOKING_URL_MAX = 500;

/**
 * @param {unknown} raw
 * @returns {{ok: true, value: string|null} | {ok: false, error: string}}
 */
export function normalizeBookingUrl(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return { ok: true, value: null };
  let value = trimmed;
  if (/^http:\/\//i.test(value)) value = `https://${value.slice(7)}`;
  else if (!/^https:\/\//i.test(value)) value = `https://${value}`;
  if (value.length > BOOKING_URL_MAX) {
    return { ok: false, error: `Booking link is too long (max ${BOOKING_URL_MAX} characters).` };
  }
  if (/\s/.test(value)) {
    return { ok: false, error: "Booking link can't contain spaces." };
  }
  return { ok: true, value };
}

/**
 * The booking link an account sends leads: users.booking_url (set by
 * scripts/managed-account.mjs), else the Calendly link. The same order
 * booking_link_sent detection uses (outbound_link_core in migration
 * 20261009120000). Every reply path, the comment DM and the reply linter
 * read it from here.
 *
 * @param {{booking_url?: string|null, calendly_url?: string|null}|null} user
 * @returns {string} the link, or "" when the account has none
 */
export function bookingLinkFor(user) {
  return user?.booking_url || user?.calendly_url || "";
}
