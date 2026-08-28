// Election schedules are stored as Philippine local wall-clock values in
// Supabase. Keep the browser display consistent with the database authority.
export const ELECTION_TIME_ZONE = "Asia/Manila";

const PHILIPPINES_OFFSET_MS = 8 * 60 * 60 * 1000;

function parsePart(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function parseScheduleDate(dateValue) {
  const match = String(dateValue ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parsePart(match[1], 1, 9999);
  const month = parsePart(match[2], 1, 12);
  const day = parsePart(match[3], 1, 31);
  if ([year, month, day].some((part) => part === null)) return null;

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year
    || utcDate.getUTCMonth() !== month - 1
    || utcDate.getUTCDate() !== day
  ) return null;

  return { year, month, day };
}

function parseScheduleTime(timeValue) {
  const match = String(timeValue ?? "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const hours = parsePart(match[1], 0, 23);
  const minutes = parsePart(match[2], 0, 59);
  const seconds = parsePart(match[3] ?? "0", 0, 59);
  if ([hours, minutes, seconds].some((part) => part === null)) return null;

  return { hours, minutes, seconds };
}

/** Convert a Philippines-local date/time to an instant. */
export function parseElectionDateTime(dateValue, timeValue) {
  const date = parseScheduleDate(dateValue);
  const time = parseScheduleTime(timeValue);
  if (!date || !time) return null;

  return new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      time.hours,
      time.minutes,
      time.seconds,
    ) - PHILIPPINES_OFFSET_MS,
  );
}

/**
 * Return the schedule-derived state. The server/database remains the final
 * authority; this is only used to prevent stale status data from presenting
 * a voting form after the configured window.
 */
export function getElectionWindowState(settings, now = new Date()) {
  const startAt = parseElectionDateTime(settings?.election_date, settings?.voting_start);
  const endAt = parseElectionDateTime(settings?.election_date, settings?.voting_end);

  if (!startAt || !endAt || endAt <= startAt) {
    return { state: "invalid", startAt, endAt, timeZone: ELECTION_TIME_ZONE };
  }

  const state = now < startAt
    ? "upcoming"
    : now >= endAt
      ? "completed"
      : "ongoing";

  return { state, startAt, endAt, timeZone: ELECTION_TIME_ZONE };
}

export function formatElectionDate(dateValue) {
  const date = parseScheduleDate(dateValue);
  if (!date) return "TBA";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: ELECTION_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

