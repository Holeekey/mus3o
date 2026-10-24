import type { Museum } from "@mus3o/shared";

const MAX_ENTRIES = 100;
const store = new Map<string, Museum>();

const key = (topic: string) => topic.trim().toLowerCase();

/** LRU: un acierto vuelve a poner la entrada al final, así se expulsa lo que nadie volvió a pedir. */
export function getCached(topic: string) {
  const k = key(topic);
  const hit = store.get(k);
  if (hit) {
    store.delete(k);
    store.set(k, hit);
  }
  return hit;
}

export function setCached(topic: string, museum: Museum) {
  const k = key(topic);
  store.delete(k);
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(k, museum);
}
