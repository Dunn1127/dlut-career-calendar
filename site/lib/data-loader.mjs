const CACHE = 'dlut-calendar-data-v1';
const CHECK_INTERVAL = 10 * 60_000;

export function createDataLoader({base = new URL('../data/', import.meta.url), fetchImpl = fetch,
  cacheStorage = globalThis.caches, now = Date.now, digest = async text => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }} = {}) {
  const dataUrl = new URL('events.json', base).href;
  let memory, pending, initialized = false;
  function parse(text) {
    const data = JSON.parse(text);
    if (data.schemaVersion !== 1 || !Array.isArray(data.events) || !data.window?.start || !data.window?.end
      || !Number.isFinite(Date.parse(data.lastSuccessAt))) throw new Error('数据格式无效');
    return data;
  }
  async function readCache() {
    try {
      const response = await (await cacheStorage.open(CACHE)).match(dataUrl);
      if (!response) return;
      const text = await response.text();
      memory = {text, data: parse(text), version: response.headers.get('X-Calendar-Version'),
        checkedAt: 0, cached: !globalThis.navigator?.onLine};
    } catch { /* Cache storage may be disabled; memory and network still work. */ }
  }
  async function persist() {
    try {
      await (await cacheStorage.open(CACHE)).put(dataUrl, new Response(memory.text, {headers: {
        'Content-Type': 'application/json', 'X-Calendar-Version': memory.version || '',
        'X-Calendar-Checked-At': String(memory.checkedAt),
      }}));
    } catch { /* Quota failures must not prevent reading online data. */ }
  }
  async function request(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetchImpl(url, {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {text: await response.text(), cached: response.headers.get('X-Calendar-Cached') === '1'};
    } finally { clearTimeout(timer); }
  }
  async function load(force) {
    if (!initialized) { await readCache(); initialized = true; }
    const age = memory ? now() - memory.checkedAt : Infinity;
    if (!force && memory && age >= 0 && age < CHECK_INTERVAL) return {data: memory.data, cached: memory.cached};
    let version;
    try {
      const result = await request(new URL('version.json', base));
      version = JSON.parse(result.text).version;
      if (!/^[a-f0-9]{64}$/.test(version)) throw new Error('数据版本无效');
    } catch (error) {
      if (memory) { memory.cached = true; return {data: memory.data, cached: true}; }
      // Supports the development server and older deployments without a manifest.
    }
    if (version && memory?.version === version) {
      memory.checkedAt = now(); memory.cached = false; await persist();
      return {data: memory.data, cached: false};
    }
    try {
      const url = new URL('events.json', base);
      url.searchParams.set('v', version || String(now()));
      const result = await request(url);
      const data = parse(result.text);
      if (result.cached) {
        if (!memory) memory = {text: result.text, data, version: null, checkedAt: 0, cached: true};
        return {data: memory.data, cached: true};
      }
      if (version && await digest(result.text) !== version) throw new Error('日程正在更新，请稍后重试');
      memory = {text: result.text, data, version, checkedAt: now(), cached: false};
      await persist();
      return {data, cached: false};
    } catch (error) {
      if (memory) { memory.cached = true; return {data: memory.data, cached: true}; }
      throw error;
    }
  }
  return {load({force = false} = {}) {
    if (!pending) pending = load(force).finally(() => { pending = null; });
    return pending;
  }};
}
