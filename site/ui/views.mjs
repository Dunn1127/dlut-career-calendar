import {formatDate, formatTime, eventStatus} from '../lib/domain.mjs';
import {node, clear, button} from './dom.mjs';
import {eventCard, smallWeekEvent} from './events.mjs';
import {sortEvents, timeGroups, weekDates, weekday, insideWindow} from './model.mjs';

export function emptyState(title, copy) {
  const wrap = node('div', 'empty-state');
  wrap.append(node('h3', '', title), node('p', '', copy));
  return wrap;
}

function appendTimeGroups(container, events, context) {
  for (const [time, group] of timeGroups(events)) {
    const row = node('section', 'time-group');
    row.append(node('span', 'time-group__label', time));
    const cards = node('div', 'time-group__events');
    for (const event of group) cards.append(eventCard(event, context));
    row.append(cards);
    container.append(row);
  }
}

export function renderTimeline(target, selectedDate, events, context) {
  clear(target);
  if (!events.length) {
    target.append(emptyState('这一天没有匹配活动', '可切换日期或调整筛选条件。'));
    const reset = button('清除筛选条件', 'button button--soft empty-reset', context.onClearFilters);
    target.append(reset);
    return;
  }
  const timeline = node('div', 'timeline');
  const today = context.today;
  if (selectedDate === today) {
    const ended = events.filter(event => eventStatus(event, context.now) === 'ended');
    const pending = events.filter(event => eventStatus(event, context.now) !== 'ended');
    if (pending.length) appendTimeGroups(timeline, pending, context);
    else timeline.append(emptyState('今天的活动已全部结束', '已结束的活动可在下方展开查看。'));
    if (ended.length) {
      const details = node('details', 'ended-group');
      details.open = context.endedExpanded;
      details.addEventListener('toggle', () => context.onEndedToggle(selectedDate, details.open));
      details.append(node('summary', '', `已结束 · ${ended.length} 场（展开查看）`));
      appendTimeGroups(details, ended, context);
      timeline.append(details);
    }
  } else {
    appendTimeGroups(timeline, events, context);
  }
  target.append(timeline);
}

export function renderWeek(target, monday, events, context) {
  clear(target);
  target.append(node('p', 'week-hint', '横向滑动可查看本周全部七天。'));
  const scroll = node('div', 'week-scroll');
  scroll.setAttribute('tabindex', '0');
  scroll.setAttribute('aria-label', '七列周历，可横向滚动');
  const grid = node('div', 'week-grid');
  for (const date of weekDates(monday)) {
    const column = node('section', `week-column${date === context.selectedDate ? ' is-selected' : ''}`);
    const dayEvents = sortEvents(events.filter(event => event.date === date));
    const inWindow = insideWindow(date, context.windowRange);
    const head = button('', 'week-column__heading', () => context.onSelectDate(date));
    head.disabled = !inWindow;
    head.append(node('strong', '', `${weekday(date)} ${date.slice(5).replace('-', '/')}`),
      node('small', '', inWindow ? `${dayEvents.length} 场` : '窗外'));
    column.append(head);
    if (!dayEvents.length) column.append(node('p', 'week-column__empty', inWindow ? '暂无活动' : '不在查询范围'));
    for (const event of dayEvents) column.append(smallWeekEvent(event, context));
    grid.append(column);
  }
  scroll.append(grid);
  target.append(scroll);
  const selectedIndex = weekDates(monday).indexOf(context.selectedDate);
  if (selectedIndex >= 0) {
    const selectedBounds = grid.children[selectedIndex].getBoundingClientRect();
    const scrollBounds = scroll.getBoundingClientRect();
    if (selectedBounds.right > scrollBounds.right) scroll.scrollLeft += selectedBounds.right - scrollBounds.right;
    else if (selectedBounds.left < scrollBounds.left) scroll.scrollLeft -= scrollBounds.left - selectedBounds.left;
  }
}

export function renderFavorites(target, favorites, context) {
  clear(target);
  if (!favorites.length) {
    target.append(emptyState('还没有收藏活动', '在全部活动中点击“收藏”，重要日程就会保存在这台设备。'));
    return;
  }
  const title = node('div', 'day-heading');
  title.append(node('h2', '', '我的收藏'), node('p', '', `共 ${favorites.length} 场 · 按日期排列`));
  target.append(title);
  const list = node('div', 'favorites-list');
  const sorted = [...favorites].sort((a, b) => a.event.date.localeCompare(b.event.date) ||
    (Date.parse(a.event.startAt ?? '') || 0) - (Date.parse(b.event.startAt ?? '') || 0));
  let lastDate = '';
  let dateSection;
  for (const item of sorted) {
    if (item.event.date !== lastDate) {
      lastDate = item.event.date;
      dateSection = node('section', 'favorites-date');
      dateSection.append(node('h2', '', `${formatDate(lastDate)} · ${weekday(lastDate)}`));
      list.append(dateSection);
    }
    dateSection.append(eventCard(item.event, context, {
      conflict: context.conflicts.has(item.id), outOfWindow: item.outOfWindow,
    }));
  }
  target.append(list);
}
