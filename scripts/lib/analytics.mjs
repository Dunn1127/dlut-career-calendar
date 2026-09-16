export function addAnalytics(html, token = '') {
  if (!token) return html;
  if (!/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(token)) {
    throw new Error('Invalid Cloudflare Web Analytics site token');
  }
  if (!html.includes('</body>')) throw new Error('Missing closing body tag');
  const notice = '<p class="service-note">本站使用 <a href="https://www.cloudflare.com/web-analytics/" target="_blank" rel="noopener noreferrer">Cloudflare Web Analytics</a> 统计访问和页面性能；本站不会把搜索词或收藏内容作为统计事件上传。</p>';
  const beacon = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({token})}'></script>`;
  return html.replace('</main>', `${notice}\n      </main>`).replace('</body>', `  ${beacon}\n  </body>`);
}
