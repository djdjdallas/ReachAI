// Shared date utilities for conversation timestamp surfaces.
//
// Why this exists: Supabase returns timestamptz columns as ISO 8601 strings
// WITH a UTC offset (e.g. "2026-06-15T10:00:00+00:00"). Hand-rolled
// `new Date(str)` calls were scattered across the conversation UI, and any
// path that ever sees a value missing its offset would parse it as LOCAL time,
// silently shifting the displayed moment. Every conversation timestamp surface
// must route through here so parsing is consistent and always UTC-anchored.

// Detect a timezone designator at the end of a timestamp string: a trailing
// "Z", or a numeric offset like "+00", "+0000", or "+00:00".
const TZ_SUFFIX = /([zZ]|[+-]\d{2}(:?\d{2})?)$/;

// parseTimestamp(value): always interpret a DB timestamp as UTC. If the value
// has a time component but no offset/"Z", append "Z" so it is never parsed as
// the viewer's local time. Returns null on falsy/invalid input.
export function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  let s = String(value).trim();
  if (!s) return null;

  const hasTime = s.includes("T") || s.includes(" ");
  if (hasTime && !TZ_SUFFIX.test(s)) {
    // Normalize a space separator (Postgres style) to "T", then mark as UTC.
    s = s.replace(" ", "T") + "Z";
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// relativeTime(value): "just now / Nm ago / Nh ago / Nd ago / <date>", computed
// against a single Date.now(). Switches to an absolute date past 30 days so the
// label stays readable for old threads.
export function relativeTime(value) {
  const date = parseTimestamp(value);
  if (!date) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return absoluteDate(date);
}

// localDayKey(value): a stable key for the viewer's LOCAL calendar day. Used to
// group messages into date buckets for the thread separator.
export function localDayKey(value) {
  const date = parseTimestamp(value);
  if (!date) return null;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// calendarLabel(value): "Today / Yesterday / <date>" for the date separator,
// computed in the VIEWER's LOCAL timezone.
export function calendarLabel(value) {
  const date = parseTimestamp(value);
  if (!date) return "";

  const startOfLocalDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfLocalDay(new Date()) - startOfLocalDay(date)) / 86400000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return absoluteDate(date);
}

// Absolute date in the viewer's locale; omits the year when it's the current
// year to keep separators terse.
function absoluteDate(date) {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
