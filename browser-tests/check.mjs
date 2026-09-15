import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import ICAL from 'ical.js';
import {addDays, shanghaiDate} from '../site/lib/domain.mjs';

const base = process.env.CALENDAR_TEST_URL ?? 'http://127.0.0.1:4173/';
const evidence = resolve(import.meta.dirname, '../../.omo/evidence/dlut/browser');
await mkdir(evidence, {recursive: true});
const snapshot = JSON.parse(await readFile(new URL('../site/data/events.json', import.meta.url), 'utf8'));
const today = shanghaiDate();
const tomorrow = addDays(today, 1);
const reports = [];
const browser = await chromium.launch({channel: 'chrome', headless: true});
const parseCalendar = text => new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent');
async function selectDay(page, date) {
  if (!(await page.locator(`[data-date="${date}"]`).count())) {
    const first = await page.locator('[data-date]').first().getAttribute('data-date');
    await page.locator(date < first ? '#previous-week' : '#next-week').click();
  }
  await page.locator(`[data-date="${date}"]`).click();
}
async function screenshot(page, name) { await page.screenshot({path: resolve(evidence, `${name}.png`), animations: 'disabled'}); }
async function captureDownload(page, trigger, name) {
  const pending = page.waitForEvent('download');
  await trigger();
  const download = await pending;
  const target = resolve(evidence, `${name}.ics`);
  await download.saveAs(target);
  return parseCalendar(await readFile(target, 'utf8'));
}

try {
  for (const width of [375, 768, 1280]) {
    const context = await browser.newContext({viewport: {width, height: 960}, acceptDownloads: true});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await expect(page.locator('#sync-meta')).toContainText('最近成功同步');
    assert.equal(await page.locator('#kind-filter').inputValue(), 'talk');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await screenshot(page, `${width}-home`);

    await page.locator('#search-filter').fill('不会匹配任何招聘的文本XYZ');
    await expect(page.locator('.empty-reset')).toBeVisible();
    await page.locator('.empty-reset').click();
    await expect(page.locator('#search-filter')).toHaveValue('');
    await expect(page.locator('#kind-filter')).toHaveValue('all');
    await selectDay(page, tomorrow);
    const first = page.locator('.event-card__open').first();
    await first.scrollIntoViewIfNeeded();
    const eventId = await first.getAttribute('data-event-id');
    await first.click();
    const scroll = await page.evaluate(() => scrollY);
    await expect(page.locator('.detail-panel')).toBeVisible();
    await expect(page.locator('#app-shell')).toHaveJSProperty('inert', true);
    const bounds = await page.locator('.detail-panel').boundingBox();
    assert.equal(width < 1024 ? bounds.y > 0 : bounds.x > 0, true);
    await screenshot(page, `${width}-detail`);
    const exported = await captureDownload(page,
      () => page.getByRole('button', {name: '导出单场日历', exact: true}).click(), `${width}-single`);
    assert.equal(exported.length, 1);
    assert.equal(exported[0].getFirstPropertyValue('uid'), `${encodeURIComponent(eventId)}@dlut-career-calendar`);
    await page.getByRole('button', {name: '收藏活动', exact: true}).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.detail-panel')).toHaveCount(0);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.eventId), eventId);
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scroll) < 4);
    await page.locator('#tab-favorites').click();
    await expect(page.locator('.favorites-list .event-card')).toHaveCount(1);
    const multiple = await captureDownload(page, () => page.locator('#export-favorites').click(), `${width}-favorites`);
    assert.equal(multiple.length, 1);
    await screenshot(page, `${width}-favorites`);
    await page.reload();
    await expect(page.locator('#favorite-total')).toHaveText('1');
    await page.locator('#tab-favorites').click();
    await expect(page.locator('.favorites-list .event-card')).toHaveCount(1);
    await page.locator('.favorite-button').click();
    await expect(page.locator('#favorite-total')).toHaveText('0');
    await page.locator('#tab-all').click();
    await page.locator('#view-week').click();
    await expect(page.locator('.week-column')).toHaveCount(7);
    await screenshot(page, `${width}-week`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    if (width < 1024) {
      await page.locator('#open-filters').click();
      await expect(page.locator('#filter-dialog')).toBeVisible();
      await page.locator('#kind-filter').selectOption('group');
      await screenshot(page, `${width}-filter`);
      await page.locator('#close-filters').click();
      await expect(page.locator('#filter-dialog')).not.toBeVisible();
      await expect(page.locator('#open-filters')).toContainText('组团招聘');
      await page.locator('#open-filters').click();
      await page.locator('#clear-filters').click();
      await page.keyboard.press('Escape');
      await expect(page.locator('#filter-dialog')).not.toBeVisible();
    } else {
      assert.ok((await page.locator('#filters').boundingBox()).x < (await page.locator('#content').boundingBox()).x);
      await expect(page.locator('#open-filters')).not.toBeVisible();
      await page.locator('#kind-filter').selectOption('group');
      assert.equal(await page.locator('#kind-filter').inputValue(), 'group');
      await page.locator('#clear-filters').click();
    }
    assert.deepEqual(errors, []);
    reports.push({width, result: 'PASS', checks: 'real data, search/reset, tomorrow, detail/focus/scroll, ICS, favorites/reload, week, filters', pageErrors: errors});
    console.log(`PASS ${width}px: browsing, details, favorites, calendar, filters`);
    await context.close();
  }

  for (const follow of [true, false]) {
    const page = await browser.newPage();
    await page.clock.install({time: new Date(`${today}T23:59:50+08:00`)});
    await page.route('**/data/events.json?*', route => route.fulfill({json: snapshot}));
    await page.goto(base);
    await expect(page.locator('#sync-meta')).toContainText('最近成功同步');
    if (!follow) await selectDay(page, addDays(today, 2));
    await page.clock.runFor(30_000);
    await expect(page.locator('.date-cell.is-selected')).toHaveAttribute('data-date', follow ? tomorrow : addDays(today, 2));
    await page.close();
  }
  reports.push({result: 'PASS', checks: 'midnight follows today; manually chosen date persists'});
  console.log('PASS midnight transitions');

  const failurePage = await browser.newPage();
  await failurePage.route('**/data/events.json?*', route => route.fulfill({status: 503, body: 'unavailable'}));
  await failurePage.goto(base);
  await expect(failurePage.locator('#status-banner')).toContainText('日程读取失败');
  await expect(failurePage.locator('#content')).not.toContainText('这一天没有匹配活动');
  await screenshot(failurePage, 'initial-fetch-failure');
  await failurePage.close();

  const blocked = await browser.newPage();
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked');}}));
  await blocked.goto(base);
  await expect(blocked.locator('#sync-meta')).toContainText('最近成功同步');
  await expect(blocked.locator('#status-banner')).toContainText('收藏暂不能长期保存');
  await selectDay(blocked, tomorrow);
  await blocked.locator('.favorite-button').first().click();
  await expect(blocked.locator('#favorite-total')).toHaveText('1');
  await blocked.close();
  reports.push({result: 'PASS', checks: 'fetch error distinguished from empty schedule; denied storage retains temporary favorites'});
  console.log('PASS failures and denied storage');
} finally {
  await writeFile(resolve(evidence, 'report.json'), JSON.stringify({testedAt: new Date().toISOString(), base, reports}, null, 2));
  await browser.close();
}
