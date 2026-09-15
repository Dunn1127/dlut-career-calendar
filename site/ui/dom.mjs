export function node(tag, className = '', value = '') {
  const created = document.createElement(tag);
  if (className) created.className = className;
  if (value !== '') created.textContent = String(value);
  return created;
}

export function clear(element) {
  element.replaceChildren();
  return element;
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function externalLink(label, value) {
  const href = safeExternalUrl(value);
  if (!href) return node('span', 'detail-muted', '原站未提供');
  const link = node('a', '', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export function button(label, className, action) {
  const result = node('button', className, label);
  result.type = 'button';
  result.addEventListener('click', action);
  return result;
}
