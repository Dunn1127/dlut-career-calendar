const SHANGHAI = 'Asia/Shanghai';
const shanghaiParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: SHANGHAI, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function escapeIcsText(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n').replaceAll('\n', '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
}

export function foldIcsLine(line) {
  const output = [];
  let current = '';
  let bytes = 0;
  for (const point of line) {
    const size = new TextEncoder().encode(point).length;
    if (bytes + size > 75) {
      output.push(current);
      current = ' ';
      bytes = 1;
    }
    current += point;
    bytes += size;
  }
  output.push(current);
  return output.join('\r\n');
}

function localStamp(iso) {
  const instant = Date.parse(iso ?? '');
  if (!Number.isFinite(instant)) return null;
  const fields = Object.fromEntries(shanghaiParts.formatToParts(instant).map(({type, value}) => [type, value]));
  return `${fields.year}${fields.month}${fields.day}T${fields.hour}${fields.minute}${fields.second}`;
}

function utcStamp(now) {
  return new Date(now).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
}

function eventLines(event, now) {
  const start = Date.parse(event.startAt ?? '');
  const end = Date.parse(event.endAt ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new RangeError('活动没有可导出的完整时间');
  const summary = [event.company, event.title].filter(Boolean).join(' · ');
  const location = [event.campus, event.venue].filter(Boolean).join(' · ');
  const description = [event.description, event.sourceUrl].filter(Boolean).join('\n');
  return [
    'BEGIN:VEVENT',
    `UID:${encodeURIComponent(event.id)}@dlut-career-calendar`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;TZID=${SHANGHAI}:${localStamp(event.startAt)}`,
    `DTEND;TZID=${SHANGHAI}:${localStamp(event.endAt)}`,
    `SUMMARY:${escapeIcsText(summary || event.title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT30M',
    `DESCRIPTION:${escapeIcsText(summary || event.title)}`,
    'END:VALARM',
    'END:VEVENT',
  ];
}

export function createIcs(events, now = Date.now()) {
  if (!events.length) throw new RangeError('没有可导出的活动');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DLUT Career Calendar//ZH-CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${SHANGHAI}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events.flatMap(event => eventLines(event, now)),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
