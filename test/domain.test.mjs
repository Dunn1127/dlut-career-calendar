import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, dateWindow, eventStatus, formatDate, formatTime,
  overlaps, shanghaiDate,
} from '../site/lib/domain.mjs';

test('Shanghai date and inclusive 21-day window survive year boundaries', () => {
  assert.equal(shanghaiDate('2026-12-31T16:30:00Z'), '2027-01-01');
  assert.equal(addDays('2027-01-01', -5), '2026-12-27');
  assert.deepEqual(dateWindow('2027-01-01'), {start: '2026-12-27', end: '2027-01-16'});
  assert.equal(addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(formatTime('2026-09-13T02:30:00Z'), '10:30');
  assert.equal(formatTime(null), '待确认');
  assert.equal(formatDate('2026-09-13'), '2026年9月13日');
});

test('half-open event status, 30-minute soon boundary, unknown time', () => {
  const event = {startAt: '2026-09-13T10:00:00+08:00', endAt: '2026-09-13T11:00:00+08:00'};
  const at = value => Date.parse(value);
  assert.equal(eventStatus(event, at('2026-09-13T09:29:59+08:00')), 'upcoming');
  assert.equal(eventStatus(event, at('2026-09-13T09:30:00+08:00')), 'soon');
  assert.equal(eventStatus(event, at('2026-09-13T10:00:00+08:00')), 'ongoing');
  assert.equal(eventStatus(event, at('2026-09-13T11:00:00+08:00')), 'ended');
  assert.equal(eventStatus({startAt: null, endAt: null}), 'unknown');
  assert.equal(eventStatus({startAt: event.startAt, endAt: null}, at('2026-09-13T10:01:00+08:00')), 'unknown');
});

test('overlap excludes touching endpoints and missing times', () => {
  const a = {startAt: '2026-09-13T10:00:00+08:00', endAt: '2026-09-13T11:00:00+08:00'};
  assert.equal(overlaps(a, {startAt: '2026-09-13T11:00:00+08:00', endAt: '2026-09-13T12:00:00+08:00'}), false);
  assert.equal(overlaps(a, {startAt: '2026-09-13T10:59:00+08:00', endAt: '2026-09-13T12:00:00+08:00'}), true);
  assert.equal(overlaps(a, {startAt: null, endAt: a.endAt}), false);
});
