import {eventStatus, formatTime} from '../lib/domain.mjs';
import {node, button} from './dom.mjs';
import {KIND_LABEL, STATUS_LABEL, CHANGE_LABEL, locationKey} from './model.mjs';

function pill(label, variant = '') {
  return node('span', `pill${variant ? ` pill--${variant}` : ''}`, label);
}

export function venueLabel(event) {
  const venue = /^https?:\/\//i.test(event.venue ?? '') ? '线上活动' : (event.venue || locationKey(event));
  return [event.campus || '校区未注明', venue || '地点待确认'].join(' · ');
}

export function eventCard(event, context, extra = {}) {
  const card = node('article', 'event-card');
  const open = button('', 'event-card__open', () => context.onOpen(event, open));
  open.dataset.eventId = event.id;
  open.setAttribute('aria-label', `查看${event.title}详情`);
  const tags = node('span', 'event-card__top');
  tags.append(node('time', 'event-card__time', `${formatTime(event.startAt)}${event.endAt ? `–${formatTime(event.endAt)}` : ''}`));
  tags.append(pill(KIND_LABEL[event.kind] ?? KIND_LABEL.other));
  const status = eventStatus(event, context.now);
  if (status !== 'upcoming') tags.append(pill(STATUS_LABEL[status], status === 'ended' ? 'muted' : ''));
  if (event.availability === 'missing') tags.append(pill('原站暂未查到', 'warning'));
  if (event.detailStatus === 'stale' || event.detailStatus === 'unavailable') tags.append(pill('详情暂未更新', 'warning'));
  for (const change of context.changeTags ? context.changeTags.get(event.id) ?? [] : event.changes ?? []) {
    tags.append(pill(CHANGE_LABEL[change] ?? change, change === 'new' ? '' : 'warning'));
  }
  if (extra.conflict) tags.append(pill('时间冲突', 'warning'));
  if (extra.outOfWindow) tags.append(pill('不再更新 · 仅保留收藏快照', 'muted'));
  open.append(tags, node('strong', '', event.title || '未命名活动'));
  if (!event.company || !event.title.includes(event.company)) open.append(node('span', 'event-card__company', event.company || '企业信息原站未提供'));
  open.append(node('span', 'event-card__meta', venueLabel(event)));
  const saved = context.favoriteIds.has(event.id);
  const favorite = button(saved ? '已收藏' : '收藏', `favorite-button${saved ? ' is-saved' : ''}`, () => context.onFavorite(event));
  favorite.dataset.favoriteId = event.id;
  favorite.setAttribute('aria-pressed', String(saved));
  favorite.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}${event.title}`);
  card.append(open, favorite);
  return card;
}

export function smallWeekEvent(event, context) {
  const result = button('', 'week-event', () => context.onOpen(event, result));
  result.dataset.eventId = event.id;
  result.append(node('time', '', formatTime(event.startAt)), node('strong', '', event.title || '未命名活动'));
  return result;
}
