// The public build replaces these values with a content hash and complete asset list.
const VERSION = 'dev';
const FILES = [];
const PREFIX = 'dlut-calendar-shell-';
const SHELL = PREFIX + VERSION;
const DATA = 'dlut-calendar-data-v1';
const base = new URL('./', self.location.href);
const dataUrl = new URL('data/events.json', base).href;
const urls = new Set(FILES.map(path => new URL(path, base).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(FILES.map(path => new Request(new URL(path, base), {cache: 'reload'})));
    // The page validates and stores data, avoiding a duplicate multi-MB download during install.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== SHELL) await caches.delete(key);
    await self.clients.claim();
  })());
});
async function getData(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(request, {signal: controller.signal, cache: 'no-store'});
    if (!response.ok) throw new Error('Data unavailable');
    return response;
  } catch {
    const cached = await (await caches.open(DATA)).match(dataUrl);
    if (!cached) return new Response('No cached calendar available', {status: 503});
    const headers = new Headers(cached.headers);
    headers.set('X-Calendar-Cached', '1');
    return new Response(await cached.arrayBuffer(), {status: 200, headers});
  } finally { clearTimeout(timeout); }
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  if (url.pathname === new URL(dataUrl).pathname) { event.respondWith(getData(event.request)); return; }
  const canonical = new URL(url.pathname, base.origin).href;
  const home = canonical === base.href || canonical === new URL('index.html', base).href;
  if (home || urls.has(canonical)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(SHELL)).match(home ? new URL('index.html', base).href : canonical);
      return cached || fetch(event.request);
    })());
  }
});
