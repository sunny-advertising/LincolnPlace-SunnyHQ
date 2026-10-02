import type { Estate } from "@/lib/types";

export type TabProps = {
  list: Estate[];
  channelName: Map<string, string>;
  estateName: Map<string, string>;
  names: Map<string, string>;
  editing: boolean;
  today: string;
  fy: number;
};

/** Most recent updated_at among rows, with who made it. */
export function lastEdit(rows: { updated_at: string; updated_by: string | null }[], names: Map<string, string>) {
  let best: { updated_at: string; updated_by: string | null } | null = null;
  for (const r of rows) if (!best || r.updated_at > best.updated_at) best = r;
  return best ? { at: best.updated_at, by: best.updated_by ? names.get(best.updated_by) ?? null : null } : { at: null, by: null };
}
