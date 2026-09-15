# 大工宣讲日历 Design System

2026-09-15 实现补充：桌面筛选固定在240px左栏，搜索位于页头；1024px以下筛选由原生dialog底部面板承载，选中条件以可移除标签展示。卡片标题18px、最多两行，完整标题在详情与无障碍名称中保留。日期条使用12px辅助字；当前日期显示“今天”。详情为不透明白色面板，验收截图在有限入场动画结束后捕获。当天已结束活动的手动展开状态在时钟刷新后保留。

## 0. Research Log

- 视觉契约：用户已确定校园浅色、主色 `#213183`、背景 `#F6F5F4`、白卡片、正文 `#31302E`、系统中文 sans、8px 节奏、12px 卡片、44px 点击区域、1024px 切换和 1280px 上限。这些约束优先于参考品牌。
- 内置参考：比对 Notion、Linear 和 Apple 的可读性方向，选择 operational taste + Notion 的暖灰、细边框和清晰内容层次；不借用其商标、图像或文案。
- Lazyweb：查询 `university career event calendar desktop`，命中 Attio 和 Front 的真实周历界面；采用「清晰的日期栏 + 事件列 + 详情层」布局语法，不复制截图。
- Imagen：用户明确要求无图片装饰，故不生成概念图。页面识别点来自深蓝日期高亮与时间轴，而非装饰素材。

## 1. Atmosphere & Identity

像学校正式信息服务一样可靠，读日期、地点和岗位时没有阻力。识别点是深蓝色的今日日期及时间轴，白色内容卡片承载招聘事实。高密度信息使用稳定的行距和浅边框，避免营销化图像与动效。

## 2. Color

| Role | CSS token | Value | Usage |
|---|---|---|---|
| 主色 | `--brand` | `#213183` | 今日、选中、主要操作、焦点 |
| 主色悬停 | `--brand-hover` | `#182664` | 可点击深蓝元素悬停 |
| 主色浅底 | `--brand-soft` | `#E9ECF8` | 活动、筛选和信息状态 |
| 背景 | `--canvas` | `#F6F5F4` | 页面底色 |
| 表面 | `--surface` | `#FFFFFF` | 卡片、工具栏、详情 |
| 正文 | `--ink` | `#31302E` | 标题、正文 |
| 次级文字 | `--muted` | `#615D59` | 地点、日期、注释 |
| 边框 | `--line` | `#E3E0DC` | 细分隔线 |
| 弱边框 | `--line-soft` | `#EEECEA` | 组内分隔 |
| 警示文字 | `--warning` | `#8A4A11` | 冲突、过期、详情故障 |
| 警示浅底 | `--warning-soft` | `#FFF1DF` | 警示提示 |
| 错误文字 | `--danger` | `#A53737` | 加载失败 |
| 错误浅底 | `--danger-soft` | `#FBEAEA` | 加载失败提示 |

仅语义状态使用警示或错误色，其他可交互元素统一深蓝。正文在表面和背景上保持 WCAG 2.2 AA 对比度。

## 3. Typography

字体栈：`-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`。数字启用 tabular figures，使时间列对齐。无网络字体请求。

| Level | Size | Weight | Line height | Usage |
|---|---|---|---|---|
| Page | 28px | 700 | 1.25 | 页面名称 |
| Section | 18px | 700 | 1.4 | 日期/区域标题 |
| Card | 16px | 650 | 1.45 | 宣讲标题 |
| Body | 16px | 400 | 1.55 | 详情正文 |
| UI | 14px | 500 | 1.45 | 筛选、按钮、元数据 |
| Small | 12px | 600 | 1.4 | 状态标签（正文不使用） |

长中文标题允许自然换行，卡片标题最多按容器宽度流动，不裁剪关键企业名。描述原文保留换行与空格，不执行 HTML。

## 4. Spacing & Layout

基础单位 8px：`--space-1: 8px`，`--space-2: 16px`，`--space-3: 24px`，`--space-4: 32px`，`--space-5: 40px`。紧凑标签间隙 `--space-half: 4px`。圆角：`--radius-card: 12px`，输入/按钮 `--radius-control: 8px`，标签 `--radius-pill: 999px`。所有点击目标 `min-height: 44px`。

内容最大宽度 `1280px`，页面水平留白桌面 24px、移动 16px。1024px 以下切单列和底部详情面板。周历固定七列，移动时局部横向滚动且不让页面整体溢出。时间轴是日期栏 + 时间分组 + 事件行，不用固定高度模拟不同事件量。

## 5. Components

### Action / Segmented Control

- 结构：原生 `button`，显式 `type=button`；主要、次要、幽灵和选中变体。
- 状态：默认、hover、active、`focus-visible`、disabled、loading；只对可操作项显示点击反馈。
- 间距：水平 `--space-2`，最小高 44px。键盘 Enter/Space 原生支持。

### Date Cell

- 结构：日期、星期、筛选后数量；今日加标记，选中使用主色实底。
- 状态：默认、今日、选中、窗外 disabled、焦点。计数为零也明确显示 0。
- 交互：日期选择不丢筛选；前后七日和回今天操作保持明确。

### Event Card

- 结构：时间、标题、企业、地点、类型/状态/变更、收藏按钮。
- 状态：即将开始、进行中、未来、已结束、时间待确认、详情失败、原站暂未查到、已收藏、冲突。
- 卡片是可聚焦详情按钮；收藏是独立按钮，避免嵌套按钮。相同开始时间共用时间组标题。

### Filter Field

- 结构：带文字标签的原生 `select` 或搜索 `input`；种类、校区、楼宇、岗位关键词。
- 状态：默认、聚焦、有值、无匹配、禁用。输入不通过 HTML 解释。

### Notice / Empty State

- 结构：简短标题 + 原因 + 可执行的下一步。变体：加载、空、错误、过期、缺失详情、冲突。
- 状态文本不只靠颜色区分；同步失败明确保留旧页面，不宣称活动取消。

### Detail Panel

- 桌面右侧 drawer；移动底部 sheet。始终有固定可见的关闭按钮和标题。
- 打开时焦点进入面板，Tab 约束于面板，Esc 与关闭按钮收起；关闭恢复触发按钮焦点及背景滚动位置。
- 内容自身滚动；安全外链仅允许 HTTP(S) 并带 `rel="noopener noreferrer"`。

## 6. Motion & Interaction

`--motion-fast: 120ms` 用于按钮按压反馈；`--motion-panel: 220ms` 用于面板进入退出，限 `transform`/`opacity`。`prefers-reduced-motion: reduce` 时无非必要过渡。加载状态用文字和布局占位，不用无意义循环动画。

今日跟随是日期选择状态：选择今天时，页面重新可见后跨日跟随新的上海日期；手选其他日期始终保留。列表与筛选刷新不改变已打开的详情或滚动定位，除非该活动已不可用。

## 7. Depth & Surface

策略为「暖灰底 + 白表面 + 细边框」。常规卡片不用装饰阴影，抽屉以轻微深蓝灰阴影区分层次。焦点轮廓为主色 2px，所有状态保持清晰边界。

## 8. Accessibility Constraints & Accepted Debt

- 目标 WCAG 2.2 AA；正文至少 14px；所有动作至少 44px；所有输入有可见标签；完整键盘流程、焦点管理、屏幕阅读器状态和减少动态效果。
- 七列周历移动端使用局部滚动容器并给出滚动提示；页面整体无横向溢出。
- 时间状态以文字呈现；未知开始/结束时间不推算、不导出无法验证时段的 ICS。

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| 无跨设备收藏同步 | 我的收藏 | 产品契约规定本机 localStorage | 产品规格变化时再评估 |
