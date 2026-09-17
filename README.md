# 大工宣讲日历

**在线访问：[大工宣讲日历](https://dunn1127.github.io/dlut-career-calendar/)** · [源码仓库](https://github.com/Dunn1127/dlut-career-calendar)

**iPhone / PWA：** 用 Safari 打开网址 → 分享 → 添加到主屏幕；如有“作为网页 App 打开”，请开启。已配置独立窗口、应用图标和离线缓存。首次联网加载并完成缓存后，可离线查看日程与收藏；缓存可能被系统清理，学校原文需要联网。恢复网络后会重新读取数据，离线数据保留原同步时间并提示。应用新版本会在旧窗口全部关闭后再次打开时启用；数据每次打开联网获取，不必重装。苹果实体设备安装及系统日历导入仍需真机确认。

**安卓安装：[下载 APK 1.0.0](https://github.com/Dunn1127/dlut-career-calendar/releases/download/android-v1.0.0/dlut-calendar-1.0.0.apk)**（Android 8.0及以上，联网使用）。收藏在应用内独立保存；导出ICS使用系统文件保存窗口。已通过[Android 15模拟器验证及签名检查](https://github.com/Dunn1127/dlut-career-calendar/actions/runs/34973549455)。使用和构建说明见 [android/README.md](android/README.md)。

2026-09-15 已完成公开发布。北京时间每天 07:15 计划自动更新；若当天数据尚未成功发布，10:15、13:15 计划补跑，实际启动时间可能延迟；以页面显示的最近成功同步时间为准。

发布验收：[首轮采集与部署](https://github.com/Dunn1127/dlut-career-calendar/actions/runs/34959037659)、[第二轮更新与部署](https://github.com/Dunn1127/dlut-career-calendar/actions/runs/34959288136)均成功；公开网址通过375、768、1280宽度的浏览、搜索、详情、收藏和ICS下载验证，以及跨日、读取失败和存储禁止场景验证。手机系统日历的实际导入尚未人工验收。

大工宣讲日历是一个由大连理工大学就业网公开信息驱动的静态日历。它按日期、活动类型、校区、楼宇、企业、岗位、专业和城市筛选近期宣讲会、组团招聘与双选会，并支持在当前浏览器收藏和导出 ICS 日历。

## 本地运行

项目要求 Node.js 24 或更高版本。首次安装和日常验证可以使用：

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm run dev` 在 `http://127.0.0.1:4173/` 提供 `site`；`npm run preview` 提供上一次构建的 `dist`。两个服务都只监听本机地址。`npm run collect` 会访问学校公开接口并在完整采集成功后更新 `site/data/events.json`，本地运行不会自动定时更新数据。

固定脚本如下：

| 命令 | 用途 |
| --- | --- |
| `npm run collect` | 读取学校就业网完整分页和活动详情，更新公开数据快照 |
| `npm test` | 运行 Node 原生测试 |
| `npm run test:browser` | 在已启动本地站点上用独立 Chrome 验证375/768/1280布局、交互和日历下载 |
| `npm run build` | 将公开的 `site` 资源复制到 `dist` |
| `npm run dev` | 在 `127.0.0.1:4173` 运行开发站点 |
| `npm run preview` | 在 `127.0.0.1:4173` 运行构建产物 |

## 数据和可靠更新

客户端每次打开先读取约百余字节的 `data/version.json`。SHA256版本未变时复用 Cache Storage 中的有效日程；只有新版本才下载完整JSON，并校验内容哈希。页面内的前后台切换最多每10分钟检查一次，恢复联网时立即重试；并发检查合并为一次请求。存储不可用时退回内存缓存，网络或校验失败时保留旧数据。版本清单在构建时与数据一同生成、发布；超过26小时未成功采集时页面提示过期。

数据源是 [大连理工大学就业网](https://job.dlut.edu.cn) 的公开招聘接口：时间线为 `POST /f/recruitmentFair/ajax_timeline`，详情按活动类型使用招聘会、组团招聘或双选会详情路由。采集器会读取完整分页，再按 Asia/Shanghai 的过去 5 天至未来 15 天窗口整理数据；详情失败会保留已有详情并标记状态。

网站只发布 `site` 下的公开资源。构建过程会清空并重新生成 `dist`，过滤测试、证据、QA 和依赖目录，并为入口页补充相对基路径，因此项目仓库部署到 GitHub Pages 子路径时仍能加载样式、脚本和数据。

云端工作流位于 `.github/workflows/deploy-pages.yml`，按 UTC 每天 23:15（北京时间每天 07:15）运行，也支持 `workflow_dispatch` 和 `main` 分支 push。它在同一个工作流中执行 `npm ci`、测试、采集、构建、快照归档和 Pages 部署。成功采集后的 `site/data/events.json` 会提交回项目仓库；该提交使用 `GITHUB_TOKEN`，而部署已经在当前运行中完成，不依赖这个提交再次触发构建。采集失败时不会部署新产物，最近一次已发布的数据继续可用，同时保留本次快照 artifact 供排查。

## 收藏与日历导出

收藏完整保存在当前浏览器的 `localStorage`，按活动 ID 合并最新数据，跨设备不会同步。单场活动或未来收藏可导出为带 Asia/Shanghai 时区、稳定 UID 和提前 30 分钟提醒的 ICS 文件。导入其他日历后，学校活动的时间和地点变更不会自动同步，请以网站和学校就业网为准。

## 维护

浏览器验收需本机安装 Chrome，并先在另一个终端运行 `npm run dev` 或 `npm run preview`。验收会建立独立临时浏览器上下文，不读取个人浏览记录或登录态。`CALENDAR_TEST_URL` 可指定验收网址；输出截图、日历文件和报告保存于上级工作区的 `.omo/evidence/dlut/browser`。页面每15秒检查活动状态及日期变化，浏览器禁止存储时会明确提示收藏仅在本次会话保留。

日常维护顺序是 `npm ci`、`npm test`、`npm run collect`、`npm run build`。采集异常时先查看 `site/data/events.json` 的 `sync.status` 和 `lastSuccessAt`，确认旧快照仍在，再检查学校接口响应或手动重新运行工作流。只有完整成功的列表采集才会比较消失项；不要把接口暂时查不到的活动标称为取消。

修改依赖时同步提交 `package.json` 和 `package-lock.json`。修改更新时间或 Pages 行为时更新 `.github/workflows/deploy-pages.yml`，并在本地用 `npm run build` 检查 `dist` 只包含网页公开资源。启用 GitHub Pages 时选择 GitHub Actions 作为构建来源；工作流需要仓库的 Pages 写入权限和 Actions 的写入权限。
