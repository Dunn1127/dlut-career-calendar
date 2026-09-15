import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fetchAllListings, fetchDetail} from '../scripts/lib/source.mjs';
import {normalizeEvent, plainText} from '../scripts/lib/normalize.mjs';
import {collectToFile} from '../scripts/lib/collect.mjs';

const now = '2026-09-13T03:00:00.000Z';
const listing = (id, type, date, hour = 10) => ({
  id, type, title: `${id} 校园招聘`, startTimeFormat: date,
  startTime: Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00+08:00`),
  endTime: Date.parse(`${date}T${String(hour + 1).padStart(2, '0')}:00:00+08:00`),
  holdPlace: '综合教学2号楼A304',
  url: `/f/recruitmentFair/show?recruitmentFairId=${id}`,
});
const page = (number, list, count, totalPage) => ({state: 1, data: {pageNo: number, totalPage, count, list}});

test('full pagination reads tail history, rejects incomplete or duplicated pages', async () => {
  const calls = [];
  const post = async (_, body) => {
    calls.push(body.pageNo);
    return body.pageNo === 1
      ? page(1, [listing('future', '宣讲会', '2026-09-20')], 2, 2)
      : page(2, [listing('history', '组团招聘', '2026-09-08')], 2, 2);
  };
  const result = await fetchAllListings({post, start: '2026-09-08'});
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(result.list.map(item => item.id), ['future', 'history']);
  await assert.rejects(fetchAllListings({post: async () => page(1, [listing('only', '宣讲会', '2026-09-13')], 2, 1), start: '2026-09-08'}), /incomplete/i);
  await assert.rejects(fetchAllListings({post: async (_, body) => page(body.pageNo, [listing('same', '宣讲会', '2026-09-13')], 2, 2), start: '2026-09-08'}), /duplicate/i);
  await assert.rejects(fetchAllListings({post: async () => page(1, [listing('invalid', '宣讲会', '2026-99-99')], 1, 1), start: '2026-09-08'}), /Invalid timeline event date/);
});

test('kind detail routes and normalized public fields remove markup and contact values', async () => {
  const paths = [];
  for (const [type, kind, route, key] of [
    ['宣讲会', 'talk', 'recruitmentFair', 'recruitmentFairId'],
    ['组团招聘', 'group', 'bilateralchosefairGroup', 'bilateralchosefairGroupId'],
    ['双选会', 'fair', 'bilateralchosefair', 'bilateralchosefairId'],
  ]) {
    const item = listing(kind, type, '2026-09-14');
    const detail = await fetchDetail(item, {post: async (path, body) => {
      paths.push(path);
      assert.equal(body[key], kind);
      return {state: 1, object: {[route]: {
        startTime: '2026-09-14 09:00:00', endTime: '2026-09-14 11:30:00',
        place: '学生文化中心A座312', campus: '大连凌水主校区',
        corporationName: '测试企业', corporationinfo: {name: '测试企业', officialWebsite: 'javascript:alert(1)'},
        content: '<p>招聘岗位<script>alert(1)</script>邮箱 hr@example.com 电话 13812345678</p>',
        recruitmentFairPositionList: [{positionName: '工程师', studentType: '本科', majorName: '物理', cityName: '大连', demandNumber: '2', positionDescription: '<b>研发</b>'}],
        groupCorporationList: [{corporationinfo: {name: '参会企业'}, content: '<p>招聘</p>'}],
      }}};
    }});
    const normalized = normalizeEvent(item, detail, null, now);
    assert.equal(normalized.id, `${kind}:${kind}`);
    assert.equal(normalized.startAt, '2026-09-14T09:00:00+08:00');
    assert.equal(normalized.endAt, '2026-09-14T11:30:00+08:00');
    assert.equal(normalized.date, '2026-09-14');
    assert.equal(normalized.companyInfo.website, '');
    assert.equal(normalized.sourceUrl, `https://job.dlut.edu.cn/f/recruitmentFair/show?recruitmentFairId=${kind}`);
    assert.equal(normalized.description.includes('招聘岗位'), true);
    assert.equal(/<|@|13812345678|alert/.test(normalized.description), false);
    assert.deepEqual(normalized.changes, ['new']);
    if (kind === 'talk') assert.equal(normalized.jobs[0].majors, '物理');
    if (kind === 'group') assert.equal(normalized.participants[0].name, '参会企业');
  }
  assert.deepEqual(paths, [
    '/f/recruitmentFair/ajax_show', '/f/bilateralchosefairGroup/ajax_show', '/f/bilateralchosefair/ajax_show',
  ]);
  assert.equal(plainText('请致电 010-12345678 或 +86 13912345678；写信 a@b.cn'), '请致电 或 ；写信');
});

test('old details survive failure; changed time and venue persist on next sync', () => {
  const item = listing('stable', '宣讲会', '2026-09-14');
  const original = normalizeEvent(item, {corporationName: '原企业', content: '<p>有效介绍</p>'}, null, now);
  const changed = normalizeEvent({...item, holdPlace: '学生文化中心A座', startTime: item.startTime + 3_600_000}, null, original, '2026-09-13T04:00:00.000Z');
  assert.equal(changed.detailStatus, 'stale');
  assert.equal(changed.company, '原企业');
  assert.equal(changed.description, '有效介绍');
  assert.deepEqual(changed.changes, ['new', 'time', 'venue']);
  assert.deepEqual(changed.previous, {startAt: original.startAt, endAt: original.endAt, venue: original.venue});
  const stable = normalizeEvent({...item, holdPlace: changed.venue, startTime: item.startTime + 3_600_000}, null, changed, '2026-09-13T05:00:00.000Z');
  assert.deepEqual(stable.changes, ['new', 'time', 'venue']);
  assert.deepEqual(stable.previous, changed.previous);
});

test('stale details from a previous snapshot are cleaned again; unknown type stays other', async () => {
  const item = listing('unknown', '新增类型', '2026-09-14');
  let called = false;
  await assert.rejects(fetchDetail(item, {post: async () => { called = true; }}), /Unknown detail route/);
  assert.equal(called, false);
  const old = normalizeEvent(item, {content: '原说明'}, null, now);
  old.company = '<b>企业</b>';
  old.companyInfo.website = 'javascript:alert(1)';
  old.companyInfo.introduction = '<script>alert(1)</script>介绍 hr@example.com';
  old.jobs = [{title: '<b>工程师</b>', description: '电话 13812345678'}];
  old.description = '<script>alert(1)</script>公开信息 hr@example.com';
  const updated = normalizeEvent(item, null, old, '2026-09-13T04:00:00.000Z');
  assert.equal(updated.kind, 'other');
  assert.equal(updated.company, '企业');
  assert.equal(updated.companyInfo.website, '');
  assert.equal(updated.companyInfo.introduction, '介绍');
  assert.equal(updated.jobs[0].title, '工程师');
  assert.equal(updated.jobs[0].description, '电话');
  assert.equal(updated.description, '公开信息');
});

test('incomplete listing leaves old snapshot byte-for-byte untouched; successful sync marks missing and new IDs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dlut-collector-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const path = join(directory, 'events.json');
  const oldEvent = normalizeEvent(listing('old-id', '宣讲会', '2026-09-14'), {content: '<p>旧详情</p>'}, null, now);
  const previous = {schemaVersion: 1, generatedAt: now, lastSuccessAt: now, window: {start: '2026-09-08', end: '2026-09-28'}, source: {url: 'https://job.dlut.edu.cn/', label: '大连理工大学就业信息网'}, sync: {status: 'ok', fetchedCount: 1, detailFailures: 0}, events: [oldEvent]};
  const bytes = JSON.stringify(previous, null, 2);
  await writeFile(path, bytes);
  await assert.rejects(collectToFile({snapshotPath: path, now, post: async () => page(1, [], 1, 1)}), /incomplete/i);
  assert.equal(await readFile(path, 'utf8'), bytes);
  const post = async (route, body) => route.endsWith('ajax_timeline')
    ? page(1, [listing('new-id', '宣讲会', '2026-09-14')], 1, 1)
    : Promise.reject(new Error('detail HTTP 500'));
  const result = await collectToFile({snapshotPath: path, now: '2026-09-13T06:00:00.000Z', post});
  assert.equal(result.sync.status, 'partial');
  assert.equal(result.sync.detailFailures, 1);
  assert.equal(result.events.find(event => event.id === 'talk:new-id').changes[0], 'new');
  assert.equal(result.events.find(event => event.id === 'talk:old-id').availability, 'missing');
  assert.equal(result.events.find(event => event.id === 'talk:old-id').description, '旧详情');
  assert.deepEqual((await readFile(path, 'utf8')).includes('detail HTTP 500'), false);
  assert.deepEqual(await readdir(directory), ['events.json']);
});
