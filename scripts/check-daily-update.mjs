import {readFile, appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {shanghaiDate} from '../site/lib/domain.mjs';

export function alreadyPublishedToday(snapshot, published, bytes, now = Date.now()) {
  return Number.isFinite(Date.parse(snapshot.lastSuccessAt))
    && shanghaiDate(snapshot.lastSuccessAt) === shanghaiDate(now)
    && published.version === createHash('sha256').update(bytes).digest('hex');
}
async function main() {
  let needed = true;
  if (process.env.GITHUB_EVENT_NAME === 'schedule') {
    try {
      const bytes = await readFile(new URL('../site/data/events.json', import.meta.url));
      const response = await fetch(`https://dunn1127.github.io/dlut-career-calendar/data/version.json?check=${Date.now()}`,
        {cache: 'no-store', signal: AbortSignal.timeout(15000)});
      if (response.ok) needed = !alreadyPublishedToday(JSON.parse(bytes), await response.json(), bytes);
    } catch (error) { console.log(`Could not verify today's publication; update will run: ${error.message}`); }
  }
  await appendFile(process.env.GITHUB_OUTPUT, `needed=${needed}\n`);
  console.log(needed ? 'A fresh collection and deployment is needed.' : 'Today’s snapshot is already public; skipping backup run.');
}
if (process.env.GITHUB_OUTPUT && process.argv[1]?.endsWith('check-daily-update.mjs')) await main();
