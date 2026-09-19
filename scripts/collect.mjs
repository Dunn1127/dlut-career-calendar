import {fileURLToPath} from 'node:url';
import {setDefaultAutoSelectFamilyAttemptTimeout} from 'node:net';
import {collectToFile} from './lib/collect.mjs';

// Overseas runners may need longer than Node's 250ms default to connect to the campus IPv4 host.
// Keep TLS verification and the existing per-request timeout enabled.
setDefaultAutoSelectFamilyAttemptTimeout(3000);

const path = fileURLToPath(new URL('../site/data/events.json', import.meta.url));
if (process.argv.includes('--help')) {
  console.log('用法: npm run collect  从大连理工大学就业信息网采集21天活动并更新 site/data/events.json');
} else {
  try {
    const snapshot = await collectToFile({snapshotPath: path});
    const kinds = Object.groupBy(snapshot.events.filter(event => event.availability === 'listed'), event => event.kind);
    console.log(JSON.stringify({fetchedCount: snapshot.sync.fetchedCount, window: snapshot.window,
      listed: Object.values(kinds).reduce((sum, events) => sum + events.length, 0),
      kinds: Object.fromEntries(Object.entries(kinds).map(([kind, events]) => [kind, events.length])),
      detailFailures: snapshot.sync.detailFailures, status: snapshot.sync.status}));
  } catch (error) {
    console.error(`采集失败，快照未更新: ${error.message}`);
    process.exitCode = 1;
  }
}
