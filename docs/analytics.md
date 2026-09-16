# 网站访问统计

已配置 Cloudflare Web Analytics，构建时将公开站点标识注入首页。`analytics.config.json` 中标识为空时不加载统计脚本，不产生访问统计。

## 获取网站统计标识

1. 登录 https://dash.cloudflare.com/，进入 Web Analytics。
2. Add a site，hostname 填 `dunn1127.github.io`（不带 https 或路径）。
3. 打开 Manage site，复制 JS snippet 中 `data-cf-beacon` 的 `token` 值，写入 `analytics.config.json` 的 `cloudflareWebAnalyticsToken`。
4. 此值是公开网页使用的站点统计标识，不是账号 API 密钥；不要把账号密钥填入此处。
5. 构建与发布后打开网站，确认脚本加载与统计请求成功，再到 Cloudflare 后台查看数据，显示可能延迟几分钟。

## 范围

统计由网页客户端上报，网页、PWA和安卓内加载的页面使用同一站点标识。它统计页面浏览与性能，不主动上传搜索词和收藏内容。离线访问、拦截插件或网络问题可能造成漏计。不能把访问次数等同真实人数，也不能把操作系统分类等同网页/APK/PWA的精确分类。

本站路径为 `/dlut-career-calendar/`，后台可按路径筛选。修改页面内的日期、筛选或收藏不额外上报点击事件，避免把交互次数混为页面浏览量。

Service Worker不预缓存第三方统计脚本，也不保存或重放统计请求。统计脚本采用defer加载，加载失败不影响日历功能。

官方说明：https://developers.cloudflare.com/web-analytics/get-started/
