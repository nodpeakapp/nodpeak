/**
 * A tiny in-process TTL cache for hot public GET responses.
 *
 * Why this exists: `/api/v1/widget-config/:id` is called once per page view
 * on every customer site that embeds the widget. That means its load scales
 * with *our customers' traffic*, not ours — a single busy customer site can
 * generate more requests than the entire dashboard ever will.
 *
 * The reverse proxy is the right place to cache it, and the bundled nginx
 * config does exactly that for /widget.js. But this app is also deployed
 * behind proxies we don't control (Coolify, Caddy, a CDN, nothing at all),
 * so the cache lives here too. Cheap, and it means the SQLite read happens
 * once per project per TTL no matter what sits in front.
 *
 * Deliberately not Redis: one container, one process. If you scale to
 * several replicas each keeps its own copy, which is harmless for a
 * read-only projection with a short TTL — the worst case is a viewer sees
 * a newly-approved review up to TTL seconds late.
 */

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();
const MAX_KEYS = 5_000;

export function cached<T>(key: string, ttlMs: number, produce: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.value as T);

  return produce().then((value) => {
    if (store.size >= MAX_KEYS) {
      for (const [k, e] of store) if (e.expiresAt <= now) store.delete(k);
      if (store.size >= MAX_KEYS) store.clear();
    }
    store.set(key, { value, expiresAt: now + ttlMs });
    return value;
  });
}

/** Call after any write that changes what the widget endpoint returns. */
export function invalidate(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

export const WIDGET_CONFIG_TTL_MS = Number(process.env.WIDGET_CONFIG_TTL_MS ?? 60_000);
