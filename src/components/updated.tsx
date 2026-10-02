import { timeAgo } from "@/lib/format";

/** "Updated 2d ago by Lily" */
export function Updated({ at, by }: { at: string | null; by?: string | null }) {
  if (!at) return <span className="muted">Not updated yet</span>;
  return (
    <span title={new Date(at).toLocaleString("en-AU")}>
      Updated {timeAgo(at)}
      {by ? ` by ${by}` : ""}
    </span>
  );
}
