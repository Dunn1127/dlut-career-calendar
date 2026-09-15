import {formatDate, formatTime} from '../lib/domain.mjs';
import {node, button, externalLink, safeExternalUrl, clear} from './dom.mjs';
import {KIND_LABEL, CHANGE_LABEL} from './model.mjs';
import {venueLabel} from './events.mjs';

const supplied = value => String(value ?? '').trim() || '原站未提供';

function detailField(list, label, value) {
  const row = node('div');
  row.append(node('dt', '', label), node('dd', '', supplied(value)));
  list.append(row);
}

function section(body, title) {
  const area = node('section', 'detail-section');
  area.append(node('h3', '', title));
  body.append(area);
  return area;
}

export function renderDetail(root, event, context) {
  clear(root);
  const backdrop = node('div', 'detail-backdrop');
  backdrop.addEventListener('click', context.onClose);
  const panel = node('aside', 'detail-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'detail-heading');
  const header = node('div', 'detail-panel__header');
  header.append(node('h2', '', '活动详情'));
  const close = button('关闭', 'button button--secondary', context.onClose);
  close.setAttribute('aria-label', '关闭活动详情');
  header.append(close);
  panel.append(header);
  const body = node('div', 'detail-panel__body');
  const tags = node('div', 'event-card__top');
  tags.append(node('span', 'pill', KIND_LABEL[event.kind] ?? KIND_LABEL.other));
  if (event.availability === 'missing') tags.append(node('span', 'pill pill--warning', '原站暂未查到'));
  if (context.conflict) tags.append(node('span', 'pill pill--warning', '与其他收藏时间冲突'));
  for (const change of context.changeTags ?? event.changes ?? []) {
    tags.append(node('span', `pill${change === 'new' ? '' : ' pill--warning'}`, CHANGE_LABEL[change] ?? change));
  }
  body.append(tags);
  const title = node('h2', 'detail-title', event.title || '未命名活动');
  title.id = 'detail-heading';
  body.append(title);
  if (event.detailStatus !== 'ok') {
    const note = node('div', 'notice notice--warning');
    note.append(node('strong', '', '详情暂未更新'), node('span', '', '当前展示已知信息，请以学校就业网为准。'));
    body.append(note);
  }
  const meta = node('dl', 'detail-meta');
  detailField(meta, '时间', `${formatDate(event.date)} ${formatTime(event.startAt)}${event.endAt ? `–${formatTime(event.endAt)}` : ''}`);
  detailField(meta, '地点', venueLabel(event));
  detailField(meta, '企业', event.company);
  body.append(meta);
  if (safeExternalUrl(event.venue)) {
    const online = node('p');
    online.append(externalLink('进入线上活动 ↗', event.venue));
    body.append(online);
  }
  if (event.previous && (event.changes?.includes('time') || event.changes?.includes('venue'))) {
    const previous = [event.previous.startAt && `原时间 ${formatTime(event.previous.startAt)}`,
      event.previous.venue && `原地点 ${event.previous.venue}`].filter(Boolean).join('；');
    if (previous) body.append(node('p', 'detail-muted', previous));
  }
  const actions = node('div', 'detail-actions');
  const favorite = button(context.saved ? '取消收藏' : '收藏活动', 'button button--soft', () => {
    const saved = context.onFavorite(event);
    favorite.textContent = saved ? '取消收藏' : '收藏活动';
    favorite.setAttribute('aria-pressed', String(saved));
  });
  favorite.setAttribute('aria-pressed', String(context.saved));
  actions.append(favorite);
  const calendar = button('导出单场日历', 'button button--primary', () => context.onCalendar(event));
  const start = Date.parse(event.startAt ?? '');
  const end = Date.parse(event.endAt ?? '');
  calendar.disabled = !Number.isFinite(start) || !Number.isFinite(end) || end <= start;
  if (calendar.disabled) calendar.title = '原站未提供完整时间，无法导出';
  actions.append(calendar);
  body.append(actions);
  body.append(node('p', 'detail-muted', '默认提前30分钟提醒。导入日历后，活动变更不会自动同步。'));

  const company = section(body, '企业信息');
  const facts = node('dl', 'detail-meta');
  detailField(facts, '性质', event.companyInfo?.nature);
  detailField(facts, '规模', event.companyInfo?.scale);
  company.append(facts);
  const website = node('p');
  website.append(node('strong', '', '官网：'), externalLink('访问企业官网 ↗', event.companyInfo?.website));
  company.append(website, node('p', '', supplied(event.companyInfo?.introduction)));

  const jobs = section(body, `招聘岗位 · ${event.jobs?.length ?? 0}`);
  if (!event.jobs?.length) jobs.append(node('p', 'detail-muted', '原站未提供岗位信息'));
  for (const job of event.jobs ?? []) {
    const entry = node('div', 'detail-job');
    entry.append(node('h3', '', supplied(job.title)));
    entry.append(node('p', 'detail-muted', [job.education, job.majors, job.city, job.headcount && `需求 ${job.headcount}`].filter(Boolean).join(' · ') || '岗位要求原站未提供'));
    if (job.description) entry.append(node('p', '', job.description));
    jobs.append(entry);
  }

  if (event.kind !== 'talk') {
  const participants = section(body, `参与企业 · ${event.participants?.length ?? 0}`);
  if (!event.participants?.length) participants.append(node('p', 'detail-muted', '原站未提供参与企业名单'));
  else {
    const list = node('ul');
    for (const participant of event.participants) {
      const item = node('li');
      item.append(node('strong', '', supplied(participant.name)));
      if (participant.description) item.append(node('p', '', participant.description));
      list.append(item);
    }
    participants.append(list);
  }
  }

  const description = section(body, '活动介绍');
  description.append(node('p', '', supplied(event.description)));
  const source = section(body, '原始信息');
  const sourceRow = node('p');
  sourceRow.append(externalLink('在学校就业网查看 ↗', event.sourceUrl));
  source.append(sourceRow);
  panel.append(body);
  root.append(backdrop, panel);
  return {panel, close};
}
