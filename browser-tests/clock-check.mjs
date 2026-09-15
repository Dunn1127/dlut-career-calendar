import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const snapshot = JSON.parse(await readFile(new URL('../site/data/events.json', import.meta.url), 'utf8'));
const event = {...snapshot.events.find(item => item.kind === 'talk'), title: '时钟边界测试宣讲',
  date: '2026-09-15', startAt: '2026-09-15T09:30:00+08:00', endAt: '2026-09-15T10:30:00+08:00'};
snapshot.events = [event];
snapshot.lastSuccessAt = '2026-09-15T01:00:00Z';
snapshot.window = {start: '2026-09-10', end: '2026-09-30'};
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage();
  await page.clock.install({time: new Date('2026-09-15T09:29:50+08:00')});
  await page.route('**/data/events.json?*', route => route.fulfill({json: snapshot}));
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('.event-card').waitFor();
  assert.match(await page.locator('.event-card').innerText(), /即将开始/);
  await page.clock.runFor(30_000);
  assert.match(await page.locator('.event-card').innerText(), /进行中/, '停留页面时必须更新活动状态');
  console.log('PASS: live event clock');
} finally {
  await browser.close();
}
