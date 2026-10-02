import { RowTools } from "@/components/editor";
import { Updated } from "@/components/updated";
import { parseDate, shortDate } from "@/lib/format";
import type { MaterialDue } from "@/lib/types";
import { lastEdit, type TabProps } from "./shared";

const CHIP: Record<MaterialDue["state"], [string, string]> = {
  overdue: ["red", "Overdue"],
  due_soon: ["gold", "Due soon"],
  due: ["grey", "Due"],
  supplied: ["green", "Supplied"],
};

export function DueTab({ material, estateName, channelName, names, editing, today }: TabProps & { material: MaterialDue[] }) {
  // Everything outstanding, plus what was due in the last 30 days and has been supplied.
  const cutoff = new Date(parseDate(today).getTime() - 30 * 86400_000).toISOString().slice(0, 10);
  const rows = material
    .filter((m) => m.state !== "supplied" || m.due_date >= cutoff)
    .sort((a, z) => a.due_date.localeCompare(z.due_date));
  const edit = lastEdit(material, names);
  const year = parseDate(today).getUTCFullYear();

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>Material due</h3>
        <span className="hint"><Updated at={edit.at} by={edit.by} /></span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Due</th><th>Estate</th><th>Placement</th><th>Specs</th><th>Supplied by</th><th>Status</th>{editing && <th />}</tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const [tone, label] = CHIP[m.state];
              return (
                <tr key={m.id}>
                  <td><b style={{ fontWeight: 500 }}>{shortDate(m.due_date, year)}</b></td>
                  <td>{estateName.get(m.estate_id)}</td>
                  <td className="wrap">
                    {m.placement}
                    <span className="muted"> · {channelName.get(m.channel_id)}{m.vendor ? ` · ${m.vendor}` : ""}</span>
                  </td>
                  <td className="muted wrap">{m.specs}</td>
                  <td>{m.supplied_by === "sunny" ? "Sunny" : "Client"}</td>
                  <td><span className={`chip ${tone}`}>{label}</span></td>
                  {editing && <td className="tools"><RowTools kind="material_due" record={m} label={`“${m.placement}”`} /></td>}
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={editing ? 7 : 6} className="empty">Nothing due. All material is supplied.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
