import {load} from 'cheerio';
import {shanghaiDate} from '../../site/lib/domain.mjs';

const SCHOOL = 'https://job.dlut.edu.cn';
const TYPES = {'宣讲会': 'talk', '组团招聘': 'group', '双选会': 'fair'};

export function kindOf(type) {
  return TYPES[type] ?? 'other';
}

export function plainText(value) {
  if (value === null || value === undefined) return '';
  const $ = load(String(value));
  $('script,style,noscript,svg,iframe,form').remove();
  $('br').replaceWith('\n');
  $('p,div,li,tr,h1,h2,h3,h4,h5,h6').append('\n');
  return $.root().text()
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+?86[\s-]?)?1[3-9]\d{9}\b/g, '')
    .replace(/\b0\d{2,3}[\s-]?\d{7,8}\b/g, '')
    .replace(/(?:联系人|联系老师|联系人姓名|联系电话|联系邮箱|电子邮箱)[：:]?[^\n。；;]*/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function safeUrl(value, schoolOnly = false) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, schoolOnly ? SCHOOL : undefined);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    if (schoolOnly && url.hostname !== 'job.dlut.edu.cn') return '';
    return url.href;
  } catch {
    return '';
  }
}

function instant(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  const local = input.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
  const zoned = local ? `${local[1]}T${local[2]}:${local[3] ?? '00'}+08:00` : input;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(zoned)) return null;
  return Number.isFinite(Date.parse(zoned)) ? zoned : null;
}

function buildingFrom(venue) {
  return venue.match(/^(.{2,28}?(?:[0-9一二三四五六七八九十]号楼|[A-Z]座|教学楼|大厦|体育馆|图书馆))/u)?.[1] ?? '';
}

function cleanedJob(job) {
  return {
    title: plainText(job?.positionName ?? job?.title),
    education: plainText(job?.studentType ?? job?.education),
    majors: plainText(job?.majorName ?? job?.majors),
    city: plainText(job?.cityName ?? job?.city),
    headcount: plainText(job?.demandNumber ?? job?.headcount),
    description: plainText(job?.positionDescription ?? job?.description),
  };
}

function cleanedParticipant(person) {
  return {
    name: plainText(person?.corporationinfo?.name ?? person?.corporationName ?? person?.name),
    description: plainText(person?.content ?? person?.description),
  };
}

export function normalizeEvent(item, detail, old, now) {
  const kind = kindOf(item.type);
  const info = detail?.corporationinfo ?? {};
  const startAt = instant(detail?.startTime) ?? instant(item.startTime);
  const endAt = instant(detail?.endTime) ?? instant(item.endTime);
  const date = startAt ? shanghaiDate(startAt) : String(item.startTimeFormat);
  const venue = plainText(detail?.place ?? detail?.realPlace ?? item.holdPlace ?? item.field);
  const hasOldDetail = old && old.detailStatus !== 'unavailable';
  const company = detail
    ? plainText(detail.corporationName ?? info.name)
    : (hasOldDetail ? plainText(old.company) : '');
  const companyInfo = detail ? {
    nature: plainText(info.corporationNatureValue),
    scale: plainText(info.corporationScaleValue),
    website: safeUrl(info.officialWebsite),
    introduction: plainText(info.corporationinfoIntroduction),
  } : (hasOldDetail ? {
    nature: plainText(old.companyInfo?.nature),
    scale: plainText(old.companyInfo?.scale),
    website: safeUrl(old.companyInfo?.website),
    introduction: plainText(old.companyInfo?.introduction),
  } : {nature: '', scale: '', website: '', introduction: ''});
  const jobs = detail
    ? (Array.isArray(detail.recruitmentFairPositionList) ? detail.recruitmentFairPositionList.map(cleanedJob) : [])
    : (hasOldDetail && Array.isArray(old.jobs) ? old.jobs.map(cleanedJob) : []);
  const participants = detail
    ? (Array.isArray(detail.groupCorporationList) ? detail.groupCorporationList.map(cleanedParticipant) : [])
    : (hasOldDetail && Array.isArray(old.participants) ? old.participants.map(cleanedParticipant) : []);
  const oldChanges = Array.isArray(old?.changes) ? old.changes.filter(change => ['new', 'time', 'venue'].includes(change)) : [];
  const changes = old ? [...oldChanges.filter(change => change !== 'new')] : ['new'];
  let previous = old?.previous;
  if (old) {
    if (old.startAt !== startAt || old.endAt !== endAt) {
      if (!changes.includes('time')) changes.push('time');
      previous ??= {startAt: old.startAt, endAt: old.endAt, venue: old.venue};
    }
    if (old.venue !== venue) {
      if (!changes.includes('venue')) changes.push('venue');
      previous ??= {startAt: old.startAt, endAt: old.endAt, venue: old.venue};
    }
    // A fresh ID stays "new" for its whole window; the site has no read acknowledgement.
    if (oldChanges.includes('new')) changes.unshift('new');
  }
  return {
    id: `${kind}:${String(item.id)}`, kind,
    title: plainText(item.title ?? detail?.title), company,
    startAt, endAt, date, venue,
    campus: plainText(detail ? detail.campus : old?.campus),
    building: buildingFrom(venue),
    sourceUrl: safeUrl(item.url, true),
    companyInfo, jobs, participants,
    description: detail ? plainText(detail.content) : (hasOldDetail ? plainText(old.description) : ''),
    detailStatus: detail ? 'ok' : (hasOldDetail ? 'stale' : 'unavailable'),
    availability: 'listed', firstSeenAt: old?.firstSeenAt ?? now, lastSeenAt: now,
    changes, ...(previous ? {previous} : {}),
  };
}
