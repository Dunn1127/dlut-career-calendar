const ZONE = 'Asia/Shanghai';
const dateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function timestamp(value) {
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function dateFields(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) throw new RangeError('Invalid date');
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== dateString) throw new RangeError('Invalid date');
  return {year, month, day, date};
}

export function shanghaiDate(value = Date.now()) {
  const instant = timestamp(value);
  if (instant === null) throw new RangeError('Invalid instant');
  const fields = Object.fromEntries(dateParts.formatToParts(instant).map(({type, value: part}) => [type, part]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function addDays(dateString, days) {
  if (!Number.isInteger(days)) throw new RangeError('Invalid day offset');
  const {date} = dateFields(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateWindow(today = shanghaiDate()) {
  return {start: addDays(today, -5), end: addDays(today, 15)};
}

export function eventStatus(event, now = Date.now()) {
  const start = event?.startAt ? timestamp(event.startAt) : null;
  const end = event?.endAt ? timestamp(event.endAt) : null;
  const current = timestamp(now);
  if (start === null || current === null || (end !== null && end <= start)) return 'unknown';
  if (current < start) return start - current <= 30 * 60_000 ? 'soon' : 'upcoming';
  if (end === null) return 'unknown';
  return current < end ? 'ongoing' : 'ended';
}

export function formatTime(value) {
  if (!value) return '待确认';
  const instant = timestamp(value);
  return instant === null ? '待确认' : timeParts.format(instant);
}

export function formatDate(dateString) {
  const {year, month, day} = dateFields(dateString);
  return `${year}年${month}月${day}日`;
}

export function overlaps(a, b) {
  const [as, ae, bs, be] = [a?.startAt, a?.endAt, b?.startAt, b?.endAt]
    .map(value => value ? timestamp(value) : null);
  return [as, ae, bs, be].every(value => value !== null)
    && as < ae && bs < be && as < be && bs < ae;
}
