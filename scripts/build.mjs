import {cp, mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {relative, resolve, sep} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const siteRoot = resolve(projectRoot, 'site');
const distRoot = resolve(projectRoot, 'dist');
const excludedSegments = new Set([
  '.git',
  '.github',
  'coverage',
  'evidence',
  'node_modules',
  'qa',
  'test',
  'tests',
  'showcase.html',
]);

function isPublicPath(sourcePath) {
  const sourceRelative = relative(siteRoot, sourcePath);
  if (sourceRelative === '') return true;
  return sourceRelative.split(sep).every(segment => !excludedSegments.has(segment));
}

async function ensureDirectory(path, label) {
  try {
    const info = await stat(path);
    if (!info.isDirectory()) throw new Error(`${label} is not a directory`);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`${label} does not exist: ${path}`);
    }
    throw error;
  }
}

await ensureDirectory(siteRoot, 'site source');
await rm(distRoot, {recursive: true, force: true});
await mkdir(distRoot, {recursive: true});

await cp(siteRoot, distRoot, {
  recursive: true,
  filter: sourcePath => isPublicPath(sourcePath),
});

// Relative resource URLs keep the built site working at a GitHub Pages
// project path such as /dlut-career-calendar/. Add an explicit base only when
// the source page has not already chosen one.
const indexPath = resolve(distRoot, 'index.html');
try {
  const index = await readFile(indexPath, 'utf8');
  if (!/<base\s/i.test(index)) {
    const withBase = index.replace(/(<head(?:\s[^>]*)?>)/i, '$1\n    <base href="./">');
    if (withBase === index) throw new Error('index.html has no <head> element');
    await writeFile(indexPath, withBase, 'utf8');
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  throw new Error(`public entrypoint is missing: ${indexPath}`);
}

await writeFile(resolve(distRoot, '.nojekyll'), '', 'utf8');
console.log(`Built public site: ${relative(projectRoot, distRoot)} (source: ${relative(projectRoot, siteRoot)})`);
