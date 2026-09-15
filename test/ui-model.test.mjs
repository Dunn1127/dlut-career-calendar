import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEvents, mondayOf, weekDates, countByDate, insideWindow, locationKey} from '../site/ui/model.mjs';

const events = [
  {id: 'talk:1', kind: 'talk', date: '2026-09-14', title: '智能制造宣讲', company: '大工企业', campus: '凌水', building: '主楼', venue: '主楼 101', jobs: [{title: '机械工程师', majors: '机械工程', city: '大连'}]},
  {id: 'group:2', kind: 'group', date: '2026-09-14', title: '联合招聘', company: '海星科技', campus: '开发区', building: '', venue: '综合楼', jobs: [{title: '算法工程师', majors: '计算机科学', city: '上海'}]},
  {id: 'fair:3', kind: 'fair', date: '2026-09-15', title: '双选会', company: '', campus: '凌水', building: '体育馆', venue: '体育馆', jobs: []},
];

test('默认类型为宣讲会时仍能搜索岗位、专业、城市与企业', () => {
  const filters = {kind: 'talk', campus: '', building: '', search: ''};
  assert.deepEqual(filterEvents(events, filters).map(event => event.id), ['talk:1']);
  for (const search of ['智能制造', '大工企业', '机械工程师', '机械工程', '大连']) {
    assert.deepEqual(filterEvents(events, {...filters, search}).map(event => event.id), ['talk:1']);
  }
  assert.deepEqual(filterEvents(events, {...filters, search: '上海'}), []);
});

test('全部类型和地点筛选保留 venue 作为空 building 的地点', () => {
  assert.deepEqual(filterEvents(events, {kind: 'all', campus: '开发区', building: '综合楼', search: '算法'}).map(event => event.id), ['group:2']);
  assert.deepEqual(filterEvents(events, {kind: 'fair', campus: '', building: '', search: ''}).map(event => event.id), ['fair:3']);
  assert.equal(locationKey({...events[1], venue: 'https://live.example.test/1'}), '线上活动');
});

test('七日栏以周一开始，窗口端点均可选且数量基于已筛选活动', () => {
  assert.equal(mondayOf('2026-09-13'), '2026-09-07');
  assert.deepEqual(weekDates('2026-09-07'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
  const counts = countByDate(filterEvents(events, {kind: 'talk', campus: '', building: '', search: ''}));
  assert.equal(counts.get('2026-09-14'), 1);
  assert.equal(counts.get('2026-09-15') ?? 0, 0);
  assert.equal(insideWindow('2026-09-08', {start: '2026-09-08', end: '2026-09-28'}), true);
  assert.equal(insideWindow('2026-09-28', {start: '2026-09-08', end: '2026-09-28'}), true);
  assert.equal(insideWindow('2026-09-29', {start: '2026-09-08', end: '2026-09-28'}), false);
});
