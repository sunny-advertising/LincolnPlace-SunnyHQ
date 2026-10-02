import { RowTools } from "@/components/editor";
import { Updated } from "@/components/updated";
import { MONTHS, dateRange, fyFraction, fyLabel, fyOf, addDays } from "@/lib/format";
import type { Flight } from "@/lib/types";
import { lastEdit, type TabProps } from "./shared";

/** FY flighting chart (Jul–Jun), grouped by estate then channel, with a today marker. */
export function PlanTab({ list, flights, channelName, names, editing, today, fy }: TabProps & { flights: Flight[] }) {
  const edit = lastEdit(flights, names);
  const todayPos = fyOf(today) === fy ? fyFraction(fy, today) : null;

  const track = (items: Flight[]) => (
    <div className="g-track">
      {MONTHS.map((m) => <span key={m} />)}
      {items.map((f) => {
        const left = fyFraction(fy, f.start_date);
        const right = fyFraction(fy, addDays(f.end_date, 1));
        return (
          <div
            key={f.id}
            className={`g-bar${f.status === "proposed" ? " alt" : ""}`}
            style={{ left: `calc(${left * 100}% + 2px)`, width: `calc(${(right - left) * 100}% - 4px)` }}
            title={`${channelName.get(f.channel_id)}${f.vendor ? " · " + f.vendor : ""} · ${dateRange(f.start_date, f.end_date)} · ${f.status}`}
          />
        );
      })}
      {todayPos !== null && <div className="g-today" style={{ left: `${todayPos * 100}%` }} aria-label="Today" />}
    </div>
  );

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{fyLabel(fy)} flighting</h3>
        <span className="hint">
          <span className="chip gold">Booked</span> <span className="chip grey">Proposed</span>
          <Updated at={edit.at} by={edit.by} />
        </span>
      </div>
      <div className="gantt">
        <div className="g-row h">
          <div>Estate / channel</div>
          <div className="g-months">{MONTHS.map((m) => <div key={m}>{m}</div>)}</div>
        </div>
        {list.map((e) => {
          const ef = flights.filter((f) => f.estate_id === e.id);
          const channels = [...new Set(ef.map((f) => f.channel_id))].sort((a, z) =>
            (channelName.get(a) ?? "").localeCompare(channelName.get(z) ?? ""));
          return (
            <div key={e.id}>
              <div className="g-row">
                <div className="lab estate">{e.name}</div>
                <div className="g-track">{MONTHS.map((m) => <span key={m} />)}{todayPos !== null && <div className="g-today" style={{ left: `${todayPos * 100}%` }} />}</div>
              </div>
              {channels.map((c) => (
                <div className="g-row" key={c}>
                  <div className="lab channel">{channelName.get(c)}</div>
                  {track(ef.filter((f) => f.channel_id === c))}
                </div>
              ))}
              {!channels.length && (
                <div className="g-row"><div className="lab channel muted">No flights yet</div>{track([])}</div>
              )}
            </div>
          );
        })}
      </div>
      {editing && flights.length > 0 && (
        <div className="tbl-wrap" style={{ borderTop: "1px solid var(--line)" }}>
          <table>
            <thead><tr><th>Estate</th><th>Channel</th><th>Vendor</th><th>Dates</th><th>Status</th><th /></tr></thead>
            <tbody>
              {flights.map((f) => (
                <tr key={f.id}>
                  <td>{list.find((e) => e.id === f.estate_id)?.name}</td>
                  <td>{channelName.get(f.channel_id)}</td>
                  <td className="muted">{f.vendor}</td>
                  <td>{dateRange(f.start_date, f.end_date)}</td>
                  <td><span className={`chip ${f.status === "booked" ? "gold" : "grey"}`}>{f.status === "booked" ? "Booked" : "Proposed"}</span></td>
                  <td className="tools"><RowTools kind="flights" record={f} label="this flight" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
