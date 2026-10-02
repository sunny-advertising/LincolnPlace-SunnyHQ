import { RowTools } from "@/components/editor";
import { Updated } from "@/components/updated";
import { dateRange, parseDate } from "@/lib/format";
import type { LivePlacement } from "@/lib/types";
import { lastEdit, type TabProps } from "./shared";

const CHIP: Record<LivePlacement["state"], [string, string]> = {
  live: ["green", "Live"],
  scheduled: ["grey", "Scheduled"],
  paused: ["grey", "Paused"],
  ended: ["grey", "Ended"],
};

export function LiveTab({ live, estateName, channelName, names, editing, today }: TabProps & { live: LivePlacement[] }) {
  // Live and upcoming, plus anything that ended in the last two weeks.
  const cutoff = new Date(parseDate(today).getTime() - 14 * 86400_000).toISOString().slice(0, 10);
  const items = live
    .filter((p) => p.state !== "ended" || (p.live_to ?? "") >= cutoff)
    .sort((a, z) => (a.state === "live" ? 0 : 1) - (z.state === "live" ? 0 : 1) || a.live_from.localeCompare(z.live_from));
  const liveCount = items.filter((p) => p.state === "live").length;
  const edit = lastEdit(live, names);
  const year = parseDate(today).getUTCFullYear();

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>Live now · {liveCount} {liveCount === 1 ? "placement" : "placements"}</h3>
        <span className="hint"><Updated at={edit.at} by={edit.by} /></span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Estate</th><th>Creative</th><th>Channel</th><th>Vendor</th><th>Live</th><th>Status</th><th />{editing && <th />}</tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const [tone, label] = CHIP[p.state];
              return (
                <tr key={p.id}>
                  <td><b style={{ fontWeight: 500 }}>{estateName.get(p.estate_id)}</b></td>
                  <td>{p.creative}</td>
                  <td>{channelName.get(p.channel_id)}</td>
                  <td className="muted">{p.vendor}</td>
                  <td>{dateRange(p.live_from, p.live_to, year)}</td>
                  <td><span className={`chip ${tone}`}>{label}</span></td>
                  <td>{p.preview_url ? <a className="link" href={p.preview_url} target="_blank" rel="noreferrer">Preview</a> : null}</td>
                  {editing && <td className="tools"><RowTools kind="live_placements" record={p} label={`“${p.creative}”`} /></td>}
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={editing ? 8 : 7} className="empty">Nothing live right now.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
