import test from 'node:test';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import {createIcs, escapeIcsText, foldIcsLine} from '../site/lib/calendar.mjs';

const event = {
  id: 'talk:中文-42', kind: 'talk', title: '招聘说明，会场；含中文与长标题'.repeat(4),
  company: '大连理工校友企业', campus: '凌水校区', venue: '综合教学楼 A101',
  description: '第一行\n第二行，含逗号；分号\\反斜杠',
  sourceUrl: 'https://job.dlut.edu.cn/f/recruitmentFair/42',
  startAt: '2026-09-14T14:00:00+08:00', endAt: '2026-09-14T15:30:00+08:00',
};

test('ICS 可由独立 ical.js 解析，时间、时区、中文和提醒正确', () => {
  const output = createIcs([event], Date.parse('2026-09-13T00:00:00Z'));
  assert.ok(output.endsWith('\r\n'));
  for (const line of output.split('\r\n').slice(0, -1)) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `超长内容行：${line}`);
  }
  const calendar = new ICAL.Component(ICAL.parse(output));
  const item = calendar.getFirstSubcomponent('vevent');
  assert.ok(item);
  assert.equal(item.getFirstPropertyValue('summary'), `${event.company} · ${event.title}`);
  assert.equal(item.getFirstPropertyValue('location'), '凌水校区 · 综合教学楼 A101');
  assert.ok(item.getFirstPropertyValue('description').includes('第一行\n第二行'));
  assert.equal(item.getFirstProperty('dtstart').getParameter('tzid'), 'Asia/Shanghai');
  assert.equal(item.getFirstProperty('dtstart').getFirstValue().toString(), '2026-09-14T14:00:00');
  assert.equal(item.getFirstProperty('dtend').getFirstValue().toString(), '2026-09-14T15:30:00');
  assert.equal(item.getFirstSubcomponent('valarm').getFirstPropertyValue('trigger').toString(), '-PT30M');
  assert.equal(item.getFirstPropertyValue('uid'), new ICAL.Component(ICAL.parse(createIcs([event], Date.now())))
    .getFirstSubcomponent('vevent').getFirstPropertyValue('uid'));
});

test('单场、批量稳定 UID 且非法时间不能被伪造', () => {
  const second = {...event, id: 'group:43', title: '第二场', startAt: '2026-09-14T16:00:00+08:00', endAt: '2026-09-14T17:00:00+08:00'};
  const parsed = new ICAL.Component(ICAL.parse(createIcs([event, second])));
  assert.equal(parsed.getAllSubcomponents('vevent').length, 2);
  assert.notEqual(parsed.getAllSubcomponents('vevent')[0].getFirstPropertyValue('uid'), parsed.getAllSubcomponents('vevent')[1].getFirstPropertyValue('uid'));
  assert.throws(() => createIcs([{...event, endAt: null}]), /完整时间/);
  assert.equal(escapeIcsText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  assert.ok(foldIcsLine('SUMMARY:' + '中文'.repeat(40)).includes('\r\n '));
});
