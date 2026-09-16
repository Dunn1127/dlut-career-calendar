import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDataLoader} from '../site/lib/data-loader.mjs';
const digest = async text => createHash('sha256').update(text).digest('hex');
function fixture() {
  let time = 1_800_000_000_000;
  let body = JSON.stringify({schemaVersion:1,events:[],window:{start:'2026-09-10',end:'2026-09-30'},lastSuccessAt:'2026-09-15T10:00:00Z'});
  let broken = false, mismatch = false;
  const counts = {version:0,data:0};
  const stored = new Map();
  const cacheStorage = {open:async()=>({match:async key=>stored.get(String(key))?.clone(),put:async(key,value)=>stored.set(String(key),value.clone())})};
  const deps = {base:new URL('https://example.test/calendar/data/'),cacheStorage,digest,now:()=>time,fetchImpl:async url=>{
    const version=String(url).includes('version.json'); counts[version?'version':'data']++;
    if (broken) throw new Error('offline');
    return new Response(version ? JSON.stringify({version:await digest(body)}) : mismatch ? body.replace('11:00:00','12:00:00') : body);
  }};
  return {deps,counts,advance:()=>time+=600001,offline:value=>broken=value,mismatch:()=>mismatch=true,
    change:()=>body=body.replace('10:00:00','11:00:00')};
}
test('one download, coalesced checks, reload cache and unchanged version reuse',async()=>{
  const f=fixture();const loader=createDataLoader(f.deps);
  await Promise.all([loader.load(),loader.load(),loader.load()]);
  assert.deepEqual(f.counts,{version:1,data:1});
  await loader.load(); await createDataLoader(f.deps).load();
  assert.deepEqual(f.counts,{version:2,data:1});
  f.advance();await loader.load();assert.deepEqual(f.counts,{version:3,data:1});
  f.change();f.advance();const updated=await loader.load();
  assert.equal(updated.data.lastSuccessAt,'2026-09-15T11:00:00Z');
  assert.deepEqual(f.counts,{version:4,data:2});
});
test('failed and inconsistent updates preserve valid snapshot and retry on reconnect',async()=>{
  const f=fixture();const loader=createDataLoader(f.deps);const initial=await loader.load();
  f.offline(true);f.advance();assert.equal((await loader.load()).cached,true);
  f.offline(false);f.change();f.mismatch();
  const invalid=await loader.load({force:true});assert.deepEqual(invalid.data,initial.data);assert.equal(invalid.cached,true);
});
test('blocked persistent storage still uses memory; empty cache reports actual failure',async()=>{
  const f=fixture(); f.deps.cacheStorage={open:async()=>{throw new Error('denied');}};
  const loader=createDataLoader(f.deps);await loader.load();f.advance();await loader.load();
  assert.equal(f.counts.data,1);
  f.offline(true);await assert.rejects(createDataLoader(f.deps).load());
});
