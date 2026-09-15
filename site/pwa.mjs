const status = document.getElementById('offline-status');
let cachedData = false;
function showStatus() {
  status.hidden = navigator.onLine && !cachedData;
  status.textContent = '正在使用已缓存的日程，可能不是最新信息。联网后会重新获取，活动请以学校原文为准。';
}
window.addEventListener('offline', showStatus);
window.addEventListener('online', () => { cachedData = false; showStatus(); window.dispatchEvent(new Event('calendar-reconnect')); });
window.addEventListener('calendar-data-source', event => { cachedData = event.detail.cached; showStatus(); });
showStatus();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {updateViaCache: 'none'}).catch(() => {
    status.hidden = false;
    status.textContent = '当前浏览器无法启用离线访问，联网时仍可正常使用。';
  });
}
