/**
 * Trip export utilities for generating downloadable calendar files.
 * Pure client-side implementation with no external dependencies.
 */

interface ExportActivity {
  name: string;
  type?: string;
  description?: string | null;
  notes?: string | null;
  customAddress?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface ExportDay {
  date: string;
  dayNumber: number;
  activities: ExportActivity[];
}

interface ExportTrip {
  title: string;
  startDate: string;
  endDate: string;
  description?: string | null;
  itinerary_days: ExportDay[];
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Format a Date as iCalendar DATE value: YYYYMMDD */
function formatICSDate(d: Date): string {
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate())
  );
}

/** Format a Date as iCalendar DATETIME value: YYYYMMDDTHHmmss */
function formatICSDateTime(d: Date): string {
  return (
    formatICSDate(d) +
    'T' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/**
 * Parse a time string like "09:00", "9:00 AM", "14:30" into
 * hours and minutes. Returns null if unparseable.
 */
function parseTime(
  timeStr: string
): { hours: number; minutes: number } | null {
  const cleaned = timeStr.trim();

  // Match "HH:MM" or "H:MM" with optional AM/PM
  const match = cleaned.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i
  );
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/**
 * Escape text for iCalendar property values per RFC 5545.
 * Backslash, semicolon, comma, and newlines must be escaped.
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold long lines per RFC 5545 (max 75 octets per line).
 * Continuation lines start with a single space.
 */
function foldLine(line: string): string {
  const maxLen = 75;
  if (line.length <= maxLen) return line;

  const parts: string[] = [];
  parts.push(line.slice(0, maxLen));
  let pos = maxLen;
  while (pos < line.length) {
    parts.push(' ' + line.slice(pos, pos + maxLen - 1));
    pos += maxLen - 1;
  }
  return parts.join('\r\n');
}

function generateUID(): string {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${now}-${rand}@atrips.com`;
}

function buildDescription(
  activity: ExportActivity
): string {
  const parts: string[] = [];
  if (activity.description) parts.push(activity.description);
  if (activity.notes) parts.push(activity.notes);
  return parts.join('\n\n');
}

/**
 * Generate a valid iCalendar (.ics) string from trip data.
 *
 * Each activity becomes a VEVENT. Activities with parseable
 * start/end times get timed events; others become all-day events.
 */
export function generateICS(trip: ExportTrip): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//atrips.com//Trip Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(trip.title)}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ];

  const now = new Date();
  const stamp = formatICSDateTime(now);

  for (const day of trip.itinerary_days) {
    const dayDate = new Date(day.date + 'T00:00:00');
    if (isNaN(dayDate.getTime())) continue;

    for (const activity of day.activities) {
      const startParsed = activity.startTime
        ? parseTime(activity.startTime)
        : null;
      const endParsed = activity.endTime
        ? parseTime(activity.endTime)
        : null;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${generateUID()}`);
      lines.push(`DTSTAMP:${stamp}`);

      if (startParsed) {
        const startDate = new Date(dayDate);
        startDate.setHours(
          startParsed.hours, startParsed.minutes, 0, 0
        );
        lines.push(
          `DTSTART;TZID=Asia/Ho_Chi_Minh:${formatICSDateTime(startDate)}`
        );

        if (endParsed) {
          const endDate = new Date(dayDate);
          endDate.setHours(
            endParsed.hours, endParsed.minutes, 0, 0
          );
          // Handle overnight: if end is before start, bump to next day
          if (endDate <= startDate) {
            endDate.setDate(endDate.getDate() + 1);
          }
          lines.push(
            `DTEND;TZID=Asia/Ho_Chi_Minh:${formatICSDateTime(endDate)}`
          );
        } else if (
          activity.duration &&
          activity.duration > 0
        ) {
          const endDate = new Date(
            startDate.getTime() + activity.duration * 60_000
          );
          lines.push(
            `DTEND;TZID=Asia/Ho_Chi_Minh:${formatICSDateTime(endDate)}`
          );
        } else {
          // Default 1-hour event when only start time is known
          const endDate = new Date(
            startDate.getTime() + 60 * 60_000
          );
          lines.push(
            `DTEND;TZID=Asia/Ho_Chi_Minh:${formatICSDateTime(endDate)}`
          );
        }
      } else {
        // All-day event when no time is available
        lines.push(
          `DTSTART;VALUE=DATE:${formatICSDate(dayDate)}`
        );
        const nextDay = new Date(dayDate);
        nextDay.setDate(nextDay.getDate() + 1);
        lines.push(
          `DTEND;VALUE=DATE:${formatICSDate(nextDay)}`
        );
      }

      lines.push(
        `SUMMARY:${escapeICSText(activity.name)}`
      );

      if (activity.customAddress) {
        lines.push(
          `LOCATION:${escapeICSText(activity.customAddress)}`
        );
      }

      if (activity.latitude && activity.longitude) {
        lines.push(
          `GEO:${activity.latitude};${activity.longitude}`
        );
      }

      const desc = buildDescription(activity);
      if (desc) {
        lines.push(
          `DESCRIPTION:${escapeICSText(desc)}`
        );
      }

      if (activity.type) {
        lines.push(
          `CATEGORIES:${escapeICSText(activity.type)}`
        );
      }

      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');

  return lines
    .map((line) => foldLine(line))
    .join('\r\n');
}

/** Trigger a file download in the browser. */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
