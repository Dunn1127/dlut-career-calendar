import {addDays, formatDate, shanghaiDate, eventStatus} from './lib/domain.mjs';
import {resilientStorage} from './lib/storage.mjs';
import {readFavorites, writeFavorites, toggleFavorite, mergeFavorites, conflictIds, futureFavoriteEvents} from './lib/favorites.mjs';
import {createIcs} from './lib/calendar.mjs';
import {node, clear} from './ui/dom.mjs';
import {filterEvents, locationOptions, countByDate, mondayOf, weekDates, weekday, insideWindow, KIND_LABEL} from './ui/model.mjs';
import {renderTimeline, renderWeek, renderFavorites, emptyState} from './ui/views.mjs';
import {renderDetail} from './ui/detail.mjs';

const ALERTS_KEY = 'dlut-career-calendar:changes:v1';
const DAY_MS = 86_400_000;
const refs = Object.fromEntries([
  'app-shell', 'sync-meta', 'status-banner', 'tab-all', 'tab-favorites', 'favorite-total',
  'export-favorites', 'browse-controls', 'range-title', 'previous-week', 'next-week',
  'today-button', 'date-strip', 'filters', 'kind-filter', 'campus-filter', 'building-filter',
  'search-filter', 'results-info', 'view-timeline', 'view-week', 'content', 'detail-root',
  'workspace', 'results-bar', 'active-filters', 'open-filters', 'close-filters', 'filter-dialog', 'clear-filters',
].map(id => [id, document.getElementById(id)]));

function availableStorage() {
  try {
    const storage = window.localStorage;
    return resilientStorage(storage);
  } catch {
    return resilientStorage(null);
  }
}

const storage = availableStorage();
function readAlerts() {
  try {
    const parsed = JSON.parse(storage.getItem(ALERTS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveAlerts() {
  storage.setItem(ALERTS_KEY, JSON.stringify(state.alerts));
}

function reconcileAlerts(events, now) {
  const current = {...state.alerts};
  for (const event of events) {
    if (!event.changes?.length) continue;
    const signature = JSON.stringify([event.changes, event.startAt, event.endAt, event.venue]);
    if (current[event.id]?.signature === signature) continue;
    current[event.id] = {signature, tags: event.changes, since: now, viewed: false};
  }
  for (const alert of Object.values(current)) {
    if (alert.viewed && now - alert.since >= DAY_MS) alert.dismissed = true;
  }
  state.alerts = current;
  saveAlerts();
}

const today = shanghaiDate();
const state = {
  snapshot: null, favorites: readFavorites(storage), alerts: readAlerts(),
  today, selectedDate: today, followToday: true, weekStart: mondayOf(today),
  section: 'all', view: 'timeline',
  filters: {kind: 'talk', campus: '', building: '', search: ''},
  loading: true, error: '', feedback: '', dialog: null, now: Date.now(), request: 0,
  endedExpanded: new Set(), clockSignature: '', renderedWeek: '',
};

function showFeedback(message) {
  state.feedback = message;
  render();
  window.setTimeout(() => {
    if (state.feedback !== message) return;
    state.feedback = '';
    render();
  }, 5000);
}

function formatSync(iso) {
  const stamp = Date.parse(iso ?? '');
  if (!Number.isFinite(stamp)) return '最近同步时间未知';
  return `最近成功同步：${new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(stamp)}`;
}

function shortRange(start, end) {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  return `${startYear}年${startMonth}月${startDay}日 — ${startYear === endYear ? '' : `${endYear}年`}${endMonth}月${endDay}日`;
}

function notice(title, message, variant) {
  const item = node('div', `notice notice--${variant}`);
  item.append(node('strong', '', title), node('span', '', message));
  return item;
}

function renderStatus() {
  clear(refs['status-banner']);
  const data = state.snapshot;
  refs['sync-meta'].textContent = data ? `${formatSync(data.lastSuccessAt)} · 当前收录 ${data.events.length} 场` :
    state.loading ? '正在读取最新日程…' : '暂时无法读取日程';
  if (state.error) refs['status-banner'].append(notice('日程读取失败',
    data ? '仍显示最近一次成功读取的日程。' : '请稍后刷新页面；已有收藏仍可查看。', 'error'));
  if (data?.sync?.status === 'partial') refs['status-banner'].append(notice(`${data.sync.detailFailures}场详情待更新`,
    '日程已更新，可查看学校原文。', 'warning'));
  if (!storage.persistent) refs['status-banner'].append(notice('收藏暂不能长期保存',
    '当前浏览器无法保存数据，收藏仅在本次页面会话有效。', 'warning'));
  const age = Date.now() - Date.parse(data?.lastSuccessAt ?? '');
  if (data && (!Number.isFinite(age) || age > 8 * 24 * 60 * 60_000)) {
    refs['status-banner'].append(notice('日程可能过期', '超过 8 天没有成功同步，请以学校就业网为准。', 'warning'));
  }
  if (state.feedback) refs['status-banner'].append(notice('操作提示', state.feedback, 'warning'));
}

function fillSelect(select, placeholder, choices, selected) {
  const previous = selected;
  clear(select);
  const base = node('option', '', placeholder);
  base.value = '';
  select.append(base);
  for (const choice of choices) {
    const option = node('option', '', choice);
    option.value = choice;
    select.append(option);
  }
  if (previous && !choices.includes(previous)) {
    const unavailable = node('option', '', `${previous}（当前未收录）`);
    unavailable.value = previous;
    select.append(unavailable);
  }
  select.value = previous;
}

function renderFilters(events) {
  const locations = locationOptions(events, state.filters.campus);
  fillSelect(refs['campus-filter'], '全部校区', locations.campuses, state.filters.campus);
  fillSelect(refs['building-filter'], '全部地点', locations.buildings, state.filters.building);
  refs['kind-filter'].value = state.filters.kind;
  if (refs['search-filter'].value !== state.filters.search) refs['search-filter'].value = state.filters.search;
}

function renderDates(filtered, windowRange) {
  clear(refs['date-strip']);
  const last = addDays(state.weekStart, 6);
  clear(refs['range-title']).append(node('span', 'range-long', shortRange(state.weekStart, last)),
    node('span', 'range-short', `${state.weekStart.slice(5).replace('-', '/')} – ${last.slice(5).replace('-', '/')}`));
  refs['range-title'].setAttribute('aria-label', shortRange(state.weekStart, last));
  const counts = countByDate(filtered);
  for (const date of weekDates(state.weekStart)) {
    const cell = node('button', `date-cell${date === state.today ? ' is-today' : ''}${date === state.selectedDate ? ' is-selected' : ''}`);
    cell.type = 'button';
    cell.disabled = !insideWindow(date, windowRange);
    cell.setAttribute('aria-label', `${formatDate(date)}，${counts.get(date) ?? 0} 场活动`);
    cell.setAttribute('aria-pressed', String(date === state.selectedDate));
    if (date === state.today) cell.setAttribute('aria-current', 'date');
    cell.dataset.date = date;
    cell.append(node('span', '', date === state.today ? '今天' : weekday(date)),
      node('strong', '', date.slice(-2)), node('small', '', cell.disabled ? '窗外' : `${counts.get(date) ?? 0} 场`));
    cell.addEventListener('click', () => selectDate(date));
    refs['date-strip'].append(cell);
  }
  const selectedCell = refs['date-strip'].querySelector('.is-selected');
  if (selectedCell) {
    const selectedBounds = selectedCell.getBoundingClientRect();
    const stripBounds = refs['date-strip'].getBoundingClientRect();
    if (selectedBounds.right > stripBounds.right) refs['date-strip'].scrollLeft += selectedBounds.right - stripBounds.right;
    else if (selectedBounds.left < stripBounds.left) refs['date-strip'].scrollLeft -= stripBounds.left - selectedBounds.left;
  }
  refs['previous-week'].disabled = addDays(state.weekStart, -1) < windowRange.start;
  refs['next-week'].disabled = addDays(state.weekStart, 7) > windowRange.end;
}

function render() {
  const focused = document.activeElement;
  const focusKey = focused?.dataset?.eventId || focused?.dataset?.favoriteId;
  const focusAttribute = focused?.dataset?.eventId ? 'eventId' : 'favoriteId';
  const weekScroll = state.renderedWeek === state.weekStart ? refs.content.querySelector('.week-scroll')?.scrollLeft : undefined;
  state.now = Date.now();
  state.clockSignature = clockSignature();
  renderStatus();
  refs.workspace.classList.toggle('is-favorites', state.section === 'favorites');
  refs['search-filter'].disabled = state.section === 'favorites';
  refs['favorite-total'].textContent = String(state.favorites.length);
  refs['tab-all'].classList.toggle('is-active', state.section === 'all');
  refs['tab-all'].setAttribute('aria-pressed', String(state.section === 'all'));
  refs['tab-favorites'].classList.toggle('is-active', state.section === 'favorites');
  refs['tab-favorites'].setAttribute('aria-pressed', String(state.section === 'favorites'));
  refs['browse-controls'].hidden = state.section === 'favorites';
  refs['export-favorites'].disabled = futureFavoriteEvents(state.favorites, state.now).length === 0;
  refs['export-favorites'].hidden = state.section !== 'favorites';
  const favoriteIds = new Set(state.favorites.map(item => item.id));
  const conflicts = conflictIds(state.favorites);
  const changeTags = new Map(Object.entries(state.alerts).map(([id, value]) => [id, value.dismissed ? [] : value.tags]));
  const context = {
    now: state.now, today: state.today, selectedDate: state.selectedDate,
    windowRange: state.snapshot?.window, favoriteIds, conflicts, changeTags,
    onOpen: openDetail, onFavorite: toggleSaved, onSelectDate: selectDate,
    endedExpanded: state.endedExpanded.has(state.selectedDate),
    onEndedToggle: (date, open) => open ? state.endedExpanded.add(date) : state.endedExpanded.delete(date),
    onClearFilters: () => resetFilters('all'),
  };
  if (state.section === 'favorites') {
    renderFavorites(refs.content, state.favorites, context);
    return;
  }
  if (!state.snapshot) {
    clear(refs.content).append(emptyState(state.loading ? '正在读取最新日程' : '暂时没有可显示的日程',
      state.loading ? '请稍候。' : '请刷新页面重试，或查看已保存的收藏。'));
    return;
  }
  renderFilters(state.snapshot.events);
  renderFilterChips();
  const filtered = filterEvents(state.snapshot.events, state.filters);
  renderDates(filtered, state.snapshot.window);
  const selected = filtered.filter(event => event.date === state.selectedDate);
  refs['results-info'].textContent = state.view === 'timeline' ? `${formatDate(state.selectedDate)} · ${weekday(state.selectedDate)} · ${selected.length} 场` :
    `本周筛选后 ${filtered.filter(event => event.date >= state.weekStart && event.date <= addDays(state.weekStart, 6)).length} 场`;
  refs['view-timeline'].classList.toggle('is-active', state.view === 'timeline');
  refs['view-week'].classList.toggle('is-active', state.view === 'week');
  refs['view-timeline'].setAttribute('aria-pressed', String(state.view === 'timeline'));
  refs['view-week'].setAttribute('aria-pressed', String(state.view === 'week'));
  if (state.view === 'week') renderWeek(refs.content, state.weekStart, filtered, context);
  else renderTimeline(refs.content, state.selectedDate, selected, context);
  state.renderedWeek = state.weekStart;
  if (weekScroll !== undefined && state.view === 'week') refs.content.querySelector('.week-scroll').scrollLeft = weekScroll;
  if (focusKey && !state.dialog) {
    [...refs.content.querySelectorAll('[data-event-id], [data-favorite-id]')]
      .find(element => element.dataset[focusAttribute] === focusKey)?.focus({preventScroll: true});
  }
}

function resetFilters(kind = 'talk') {
  state.filters = {kind, campus: '', building: '', search: ''};
  render();
}

function renderFilterChips() {
  clear(refs['active-filters']);
  refs['open-filters'].textContent = `${KIND_LABEL[state.filters.kind] ?? '全部'} · 筛选`;
  const labels = {kind: KIND_LABEL[state.filters.kind] ?? '全部类型', campus: state.filters.campus,
    building: state.filters.building, search: state.filters.search && `搜索：${state.filters.search}`};
  for (const [key, label] of Object.entries(labels)) {
    if (!label || key === 'kind') continue;
    const chip = node('button', 'filter-chip', `${label} ×`);
    chip.type = 'button';
    chip.setAttribute('aria-label', `移除筛选：${label}`);
    chip.addEventListener('click', () => {
      state.filters[key] = key === 'kind' ? 'all' : '';
      if (key === 'campus') state.filters.building = '';
      render();
    });
    if (key !== 'kind' || state.filters.kind !== 'all') refs['active-filters'].append(chip);
  }
}

function clockSignature() {
  const events = state.section === 'favorites' ? state.favorites.map(item => item.event) : state.snapshot?.events ?? [];
  const old = Date.now() - Date.parse(state.snapshot?.lastSuccessAt ?? '') > 8 * 24 * 60 * 60_000;
  return `${shanghaiDate()}|${old}|${events.map(event => eventStatus(event)).join(',')}`;
}

function tickClock() {
  const date = shanghaiDate();
  const changedDay = date !== state.today;
  if (changedDay) {
    state.today = date;
    if (state.followToday) { state.selectedDate = date; state.weekStart = mondayOf(date); }
  }
  if (state.clockSignature !== clockSignature()) render();
  if (changedDay) refreshData();
}

function selectDate(date) {
  if (!state.snapshot) return;
  if (!insideWindow(date, state.snapshot.window)) return;
  state.selectedDate = date;
  state.followToday = date === state.today;
  state.weekStart = mondayOf(date);
  render();
}

function shiftWeek(days) {
  if (!state.snapshot) return;
  const proposed = addDays(state.weekStart, days);
  if (addDays(proposed, 6) < state.snapshot.window.start || proposed > state.snapshot.window.end) return;
  state.weekStart = proposed;
  state.selectedDate = proposed < state.snapshot.window.start ? state.snapshot.window.start : proposed;
  state.followToday = state.selectedDate === state.today;
  render();
}

function toggleSaved(event) {
  state.favorites = toggleFavorite(state.favorites, event);
  writeFavorites(storage, state.favorites);
  const saved = state.favorites.some(item => item.id === event.id);
  render();
  if (!state.dialog) {
    const trigger = [...document.querySelectorAll('[data-favorite-id]')].find(item => item.dataset.favoriteId === event.id);
    trigger?.focus({preventScroll: true});
  }
  return saved;
}

function downloadCalendar(events, filename) {
  try {
    const contents = createIcs(events);
    if (window.AndroidCalendar?.postMessage) {
      window.AndroidCalendar.postMessage(JSON.stringify({filename, contents}));
      return;
    }
    const href = URL.createObjectURL(new Blob([contents], {type: 'text/calendar;charset=utf-8'}));
    const link = node('a');
    link.href = href;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } catch (error) {
    showFeedback(error.message || '日历导出失败');
  }
}

function onDialogKeydown(event) {
  if (!state.dialog) return;
  if (event.key === 'Escape') { event.preventDefault(); closeDetail(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...state.dialog.panel.querySelectorAll('button:not(:disabled), a[href], input, select')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function openDetail(event, opener) {
  if (state.dialog) closeDetail();
  if (state.alerts[event.id]) {
    state.alerts[event.id].viewed = true;
    saveAlerts();
  }
  const previousOverflow = document.body.style.overflow;
  const scrollY = window.scrollY;
  const rendered = renderDetail(refs['detail-root'], event, {
    saved: state.favorites.some(item => item.id === event.id),
    conflict: conflictIds(state.favorites).has(event.id),
    changeTags: state.alerts[event.id]?.dismissed ? [] : state.alerts[event.id]?.tags,
    onClose: closeDetail, onFavorite: toggleSaved,
    onCalendar: current => downloadCalendar([current], `dlut-${encodeURIComponent(current.id)}.ics`),
  });
  state.dialog = {opener, scrollY, previousOverflow, panel: rendered.panel};
  refs['app-shell'].inert = true;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onDialogKeydown);
  rendered.close.focus();
}

function closeDetail() {
  if (!state.dialog) return;
  const {opener, scrollY, previousOverflow} = state.dialog;
  state.dialog = null;
  document.removeEventListener('keydown', onDialogKeydown);
  refs['app-shell'].inert = false;
  clear(refs['detail-root']);
  document.body.style.overflow = previousOverflow;
  window.scrollTo(window.scrollX, scrollY);
  const replacement = opener.isConnected ? opener : [...document.querySelectorAll('[data-event-id]')]
    .find(item => item.dataset.eventId === opener.dataset.eventId);
  (replacement ?? refs['tab-all']).focus({preventScroll: true});
}

async function refreshData() {
  const request = ++state.request;
  try {
    const response = await fetch(`./data/events.json?view=${Date.now()}`, {cache: 'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.schemaVersion !== 1 || !Array.isArray(data.events) || !data.window?.start || !data.window?.end) {
      throw new Error('数据格式无效');
    }
    if (request !== state.request) return;
    window.dispatchEvent(new CustomEvent('calendar-data-source', {detail: {cached: response.headers.get('X-Calendar-Cached') === '1'}}));
    const freshToday = shanghaiDate();
    if (state.followToday && freshToday !== state.today) {
      state.selectedDate = freshToday;
      state.weekStart = mondayOf(freshToday);
    }
    state.today = freshToday;
    state.snapshot = data;
    state.favorites = mergeFavorites(state.favorites, data);
    writeFavorites(storage, state.favorites);
    reconcileAlerts(data.events, Date.now());
    state.error = '';
  } catch (error) {
    if (request !== state.request) return;
    state.error = error.message || '读取失败';
  } finally {
    if (request === state.request) { state.loading = false; render(); }
  }
}

refs['tab-all'].addEventListener('click', () => { state.section = 'all'; render(); });
refs['tab-favorites'].addEventListener('click', () => { state.section = 'favorites'; render(); });
refs['view-timeline'].addEventListener('click', () => { state.view = 'timeline'; render(); });
refs['view-week'].addEventListener('click', () => { state.view = 'week'; render(); });
refs['today-button'].addEventListener('click', () => {
  state.today = shanghaiDate(); state.selectedDate = state.today;
  state.weekStart = mondayOf(state.today); state.followToday = true; render();
});
refs['previous-week'].addEventListener('click', () => shiftWeek(-7));
refs['next-week'].addEventListener('click', () => shiftWeek(7));
refs['kind-filter'].addEventListener('change', event => { state.filters.kind = event.target.value; render(); });
refs['campus-filter'].addEventListener('change', event => {
  state.filters.campus = event.target.value; state.filters.building = ''; render();
});
refs['building-filter'].addEventListener('change', event => { state.filters.building = event.target.value; render(); });
refs['search-filter'].addEventListener('input', event => { state.filters.search = event.target.value; render(); });
refs['filters']?.addEventListener('submit', event => event.preventDefault());
refs['export-favorites'].addEventListener('click', () => {
  const events = futureFavoriteEvents(state.favorites);
  if (!events.length) { showFeedback('没有带完整时间的未来收藏活动可导出。'); return; }
  downloadCalendar(events, 'dlut-favorites.ics');
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { tickClock(); refreshData(); }
});
refs['clear-filters'].addEventListener('click', () => resetFilters());
refs['open-filters'].addEventListener('click', () => {
  refs['filter-dialog'].append(refs.filters);
  refs['filter-dialog'].showModal();
});
refs['close-filters'].addEventListener('click', () => refs['filter-dialog'].close());
refs['filter-dialog'].addEventListener('close', () => {
  refs['browse-controls'].insertBefore(refs.filters, refs['results-bar']);
});
refs['filter-dialog'].addEventListener('click', event => {
  if (event.target !== refs['filter-dialog']) return;
  const box = event.target.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close();
});
window.setInterval(tickClock, 15_000);
window.addEventListener('calendar-reconnect', refreshData);
render();
refreshData();
