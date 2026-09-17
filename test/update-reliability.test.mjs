import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {postJson} from '../scripts/lib/source.mjs';
import {alreadyPublishedToday} from '../scripts/check-daily-update.mjs';
test('source recovers transient transport errors and preserves failure diagnosis', async () => {
  let calls = 0;
  const sleep = async () => {};
  assert.deepEqual(await postJson('/f/test', {}, {sleep, fetchImpl: async () => {
    if (++calls < 3) throw new TypeError('fetch failed', {cause: {code:'ECONNRESET', message:'socket closed'}});
    return new Response('{"state":1}');
  }}), {state:1});
  assert.equal(calls,3);
  await assert.rejects(postJson('/f/test',{}, {sleep,fetchImpl:async()=>{throw new TypeError('fetch failed',{cause:{code:'ETIMEDOUT'}});}}), /ETIMEDOUT/);
  calls=0;
  await assert.rejects(postJson('/f/test',{}, {sleep,fetchImpl:async()=>{calls++;return new Response('',{status:403});}}), /403/);
  assert.equal(calls,1);
});
test('backup skips only when a matching snapshot for today is actually published', () => {
  const bytes=Buffer.from('{"lastSuccessAt":"2026-09-17T00:00:00Z"}');
  const snapshot=JSON.parse(bytes), published={version:createHash('sha256').update(bytes).digest('hex')};
  assert.equal(alreadyPublishedToday(snapshot,published,bytes,Date.parse('2026-09-17T02:00:00Z')),true);
  assert.equal(alreadyPublishedToday(snapshot,{version:'old'},bytes,Date.parse('2026-09-17T02:00:00Z')),false);
  assert.equal(alreadyPublishedToday(snapshot,published,bytes,Date.parse('2026-09-17T16:00:00Z')),false);
});
