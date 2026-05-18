/**
 * Genera un archivo .ics (iCalendar) para "Add to Calendar".
 * Compatible con Apple Calendar, Google Calendar, Outlook.
 */

interface IcsEventInput {
  title: string;
  start: Date | string;
  durationMinutes?: number;
  location?: string;
  description?: string;
  url?: string;
  uid?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIcsDate(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escape(s: string = ''): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function buildIcs(input: IcsEventInput): string {
  const start = typeof input.start === 'string' ? new Date(input.start) : input.start;
  const durationMs = (input.durationMinutes ?? 4 * 60) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  const uid = input.uid ?? `${Date.now()}@midnightcorp.click`;
  const now = new Date();

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Midnight Corp//Event//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escape(input.title)}`,
    input.location ? `LOCATION:${escape(input.location)}` : '',
    input.description ? `DESCRIPTION:${escape(input.description)}` : '',
    input.url ? `URL:${escape(input.url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export function downloadIcs(input: IcsEventInput, filename: string = 'midnight-event.ics'): void {
  const ics = buildIcs(input);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Link directo a Google Calendar (sin descarga, abre en browser).
 * Útil como alternativa móvil-first.
 */
export function googleCalendarLink(input: IcsEventInput): string {
  const start = typeof input.start === 'string' ? new Date(input.start) : input.start;
  const end = new Date(start.getTime() + (input.durationMinutes ?? 240) * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${toIcsDate(start).replace(/[-:]/g, '')}/${toIcsDate(end).replace(/[-:]/g, '')}`,
    details: input.description ?? '',
    location: input.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
