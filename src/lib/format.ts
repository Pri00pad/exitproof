// Dates are rendered on the server, so use one fixed display time zone
// (the target users are in India) instead of the server's own zone.
const DISPLAY_TIME_ZONE = "Asia/Kolkata";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: DISPLAY_TIME_ZONE,
});

const dateOnlyFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
  timeZoneName: "short",
});

/** Formats a timestamptz as date + time in the display time zone. */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** Formats a timestamptz (e.g. submitted_at) as a date in the display time zone. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formats a Postgres `date` (YYYY-MM-DD) without shifting it across time zones. */
export function formatDateOnly(isoDate: string): string {
  return dateOnlyFormat.format(new Date(`${isoDate}T00:00:00Z`));
}
