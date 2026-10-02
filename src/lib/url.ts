export type Query = Record<string, string | string[] | undefined>;

/** Builds `path?…` from current params plus overrides (undefined/"" removes a key). */
export function withQuery(path: string, current: Query, overrides: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (typeof v === "string" && v !== "" && !(k in overrides)) q.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
