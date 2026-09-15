import {addDays} from '../../site/lib/domain.mjs';

const BASE_URL = 'https://job.dlut.edu.cn';
const TIMELINE = '/f/recruitmentFair/ajax_timeline';
const DETAIL_ROUTES = {
  宣讲会: ['recruitmentFair', 'recruitmentFairId'],
  组团招聘: ['bilateralchosefairGroup', 'bilateralchosefairGroupId'],
  双选会: ['bilateralchosefair', 'bilateralchosefairId'],
};

export async function postJson(path, body, {fetchImpl = fetch} = {}) {
  const response = await fetchImpl(new URL(path, BASE_URL), {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Source HTTP ${response.status} at ${path}`);
  return response.json();
}

export async function fetchAllListings({post = postJson, start, pageSize = 100}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new RangeError('Invalid window start');
  const all = [];
  let count;
  let pages;
  for (let number = 1; pages === undefined || number <= pages; number += 1) {
    const payload = await post(TIMELINE, {pageNo: number, pageSize, fairDate: start, title: ''});
    const data = payload?.data;
    if (Number(payload?.state) !== 1 || !data || !Array.isArray(data.list)
      || !Number.isInteger(Number(data.count)) || !Number.isInteger(Number(data.totalPage))
      || Number(data.pageNo) !== number) throw new Error(`Invalid timeline page ${number}`);
    if (count === undefined) {
      count = Number(data.count);
      pages = Number(data.totalPage);
      if (count < 0 || pages < 0 || (pages === 0 && count !== 0)) throw new Error('Invalid timeline totals');
    } else if (count !== Number(data.count) || pages !== Number(data.totalPage)) {
      throw new Error('Timeline pages changed during pagination');
    }
    all.push(...data.list);
  }
  if (all.length !== count) throw new Error(`Incomplete timeline: expected ${count}, got ${all.length}`);
  const keys = new Set();
  for (const item of all) {
    if (!item || !String(item.id ?? '').trim() || !String(item.type ?? '').trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(String(item.startTimeFormat ?? ''))) {
      throw new Error('Invalid timeline event');
    }
    try {
      addDays(item.startTimeFormat, 0);
    } catch {
      throw new Error('Invalid timeline event date');
    }
    const key = `${item.type}:${item.id}`;
    if (keys.has(key)) throw new Error(`Duplicate timeline event ${key}`);
    keys.add(key);
  }
  return {list: all, count};
}

export async function fetchDetail(item, {post = postJson} = {}) {
  const selection = DETAIL_ROUTES[item.type];
  if (!selection) throw new Error(`Unknown detail route for ${item.type}`);
  const [route, key] = selection;
  const payload = await post(`/f/${route}/ajax_show`, {[key]: item.id});
  const detail = payload?.object?.[route];
  if (Number(payload?.state) !== 1 || !detail || typeof detail !== 'object') {
    throw new Error(`Invalid detail response for ${item.type}:${item.id}`);
  }
  return detail;
}
