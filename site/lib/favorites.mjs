import {overlaps} from './domain.mjs';

export const FAVORITES_KEY = 'dlut-career-calendar:favorites:v1';

export function readFavorites(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string' && item.event?.id === item.id) : [];
  } catch {
    return [];
  }
}

export function writeFavorites(storage, favorites) {
  storage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function toggleFavorite(favorites, event, now = Date.now()) {
  if (favorites.some(item => item.id === event.id)) return favorites.filter(item => item.id !== event.id);
  return [...favorites, {id: event.id, event: structuredClone(event), savedAt: new Date(now).toISOString(), outOfWindow: false}];
}

export function mergeFavorites(favorites, dataset) {
  const byId = new Map(dataset.events.map(event => [event.id, event]));
  return favorites.map(item => {
    const current = byId.get(item.id);
    const event = current ? structuredClone(current) : item.event;
    return {...item, event, outOfWindow: event.date < dataset.window.start || event.date > dataset.window.end};
  });
}

export function conflictIds(favorites) {
  const conflicts = new Set();
  for (let index = 0; index < favorites.length; index += 1) {
    for (let other = index + 1; other < favorites.length; other += 1) {
      if (!overlaps(favorites[index].event, favorites[other].event)) continue;
      conflicts.add(favorites[index].id);
      conflicts.add(favorites[other].id);
    }
  }
  return conflicts;
}

export function futureFavoriteEvents(favorites, now = Date.now()) {
  return favorites.map(item => item.event).filter(event => {
    const start = Date.parse(event.startAt ?? '');
    const end = Date.parse(event.endAt ?? '');
    return Number.isFinite(start) && Number.isFinite(end) && start > now && end > start;
  });
}
