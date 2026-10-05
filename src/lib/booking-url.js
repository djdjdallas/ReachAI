// Leaf module, no imports. Normalizes the booking link (users.calendly_url)
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
