import type { Museum } from "@mus3o/shared";

const MAX_ENTRIES = 100;
const store = new Map<string, Museum>();

const key = (topic: string) => topic.trim().toLowerCase();

export const getCached = (topic: string) => store.get(key(topic));

export function setCached(topic: string, museum: Museum) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key(topic), museum);
}
