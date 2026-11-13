type Entry = { value: unknown; expires: number };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
// keys include user-typed symbols, so cap the store to keep memory bounded
const MAX_ENTRIES = 2000;

/** Small in-memory TTL cache so several open panels don't hammer the data providers. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = load()
    .then((value) => {
      store.delete(key);
      store.set(key, { value, expires: Date.now() + ttlMs });
      // Maps iterate in insertion order, so the first keys are the oldest
      for (const k of store.keys()) {
        if (store.size <= MAX_ENTRIES) break;
        store.delete(k);
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
