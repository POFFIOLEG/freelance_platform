/** Событие для мгновенного обновления избранного в профиле и др. экранах (та же вкладка). */
export const FAVORITES_STORAGE_EVENT = "taskora-favorites-changed";

export function broadcastFavoritesChanged(storageKey) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FAVORITES_STORAGE_EVENT, { detail: { key: storageKey } }));
}
