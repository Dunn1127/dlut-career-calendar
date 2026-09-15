import {addDays, formatTime} from '../lib/domain.mjs';

export const KIND_LABEL = Object.freeze({talk: '宣讲会', group: '组团招聘', fair: '双选会', other: '其他'});
export const STATUS_LABEL = Object.freeze({ongoing: '进行中', soon: '即将开始', upcoming: '未开始', ended: '已结束', unknown: '时间待确认'});
export const CHANGE_LABEL = Object.freeze({new: '新收录', time: '时间有变更', venue: '地点有变更'});

export function locationKey(event) {
  const value = event.building || event.venue || '';
  return /^https?:\/\//i.test(value) ? '线上活动' : value;
}

export function filterEvents(events, filters) {
  const query = (filters.search ?? '').trim().toLocaleLowerCase('zh-CN');
  return events.filter(event => {
    if (filters.kind && filters.kind !== 'all' && event.kind !== filters.kind) return false;
    if (filters.campus && event.campus !== filters.campus) return false;
    if (filters.building && locationKey(event) !== filters.building) return false;
    if (!query) return true;
    const fields = [event.title, event.company, ...event.jobs.flatMap(job => [job.title, job.majors, job.city])];
    return fields.some(value => String(value ?? '').toLocaleLowerCase('zh-CN').includes(query));
  });
}

export function locationOptions(events, campus = '') {
  const campuses = [...new Set(events.map(event => event.campus).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const buildings = [...new Set(events.filter(event => !campus || event.campus === campus)
    .map(locationKey).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return {campuses, buildings};
}

export function mondayOf(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

export function weekDates(monday) {
  return Array.from({length: 7}, (_, index) => addDays(monday, index));
}

export function countByDate(events) {
  const counts = new Map();
  for (const event of events) counts.set(event.date, (counts.get(event.date) ?? 0) + 1);
  return counts;
}

export function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aTime = a.startAt ? Date.parse(a.startAt) : Number.POSITIVE_INFINITY;
    const bTime = b.startAt ? Date.parse(b.startAt) : Number.POSITIVE_INFINITY;
    return aTime - bTime || a.title.localeCompare(b.title, 'zh-CN');
  });
}

export function timeGroups(events) {
  const grouped = new Map();
  for (const event of sortEvents(events)) {
    const label = formatTime(event.startAt);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(event);
  }
  return grouped;
}

export function weekday(date) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function insideWindow(date, windowRange) {
  return date >= windowRange.start && date <= windowRange.end;
}
