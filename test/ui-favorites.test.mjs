import test from 'node:test';
import assert from 'node:assert/strict';
import {readFavorites, writeFavorites, toggleFavorite, mergeFavorites, conflictIds, futureFavoriteEvents} from '../site/lib/favorites.mjs';

const event = (id, startAt, endAt, date = '2026-09-14') => ({
  id, kind: 'talk', date, startAt, endAt, title: id, company: '企业', jobs: [], participants: [],
});
const first = event('talk:1', '2026-09-14T09:00:00+08:00', '2026-09-14T10:00:00+08:00');
const touching = event('talk:2', '2026-09-14T10:00:00+08:00', '2026-09-14T11:00:00+08:00');
const overlapping = event('talk:3', '2026-09-14T09:30:00+08:00', '2026-09-14T10:30:00+08:00');

test('本机收藏保存完整快照，按 id 更新且过窗仍保留', () => {
  const saved = toggleFavorite([], first, Date.parse('2026-09-13T00:00:00Z'));
  const backing = new Map();
  const storage = {getItem: key => backing.get(key) ?? null, setItem: (key, value) => backing.set(key, value)};
  writeFavorites(storage, saved);
  assert.deepEqual(readFavorites(storage)[0].event, first);
  const changed = {...first, title: '时间改动后标题', startAt: '2026-09-14T09:15:00+08:00'};
  const merged = mergeFavorites(saved, {window: {start: '2026-09-08', end: '2026-09-28'}, events: [changed]});
  assert.equal(merged[0].event.title, '时间改动后标题');
  const nextWindow = mergeFavorites(merged, {window: {start: '2026-09-29', end: '2026-10-19'}, events: []});
  assert.equal(nextWindow[0].outOfWindow, true);
  assert.deepEqual(nextWindow[0].event, changed);
  assert.deepEqual(toggleFavorite(nextWindow, first), []);
});

test('冲突只标真实重叠，结束等于开始不冲突', () => {
  const favorites = [first, touching, overlapping].map(item => ({id: item.id, event: item}));
  assert.deepEqual([...conflictIds(favorites.slice(0, 2))], []);
  assert.deepEqual([...conflictIds(favorites)].sort(), ['talk:1', 'talk:2', 'talk:3']);
});

test('批量日历仅含有完整时间的未来收藏', () => {
  const unknown = event('talk:4', null, null);
  const favorites = [first, touching, unknown].map(item => ({id: item.id, event: item}));
  assert.deepEqual(futureFavoriteEvents(favorites, Date.parse('2026-09-14T01:30:00Z')).map(item => item.id), ['talk:2']);
});
