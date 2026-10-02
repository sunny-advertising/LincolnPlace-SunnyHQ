import { RowTools } from "@/components/editor";
import type { Report } from "@/lib/types";

/** Whatagraph dashboards as link cards (share links are opened in Whatagraph, not embedded). */
export function DashboardLinks({ reports, editing, scopeLabel }: {
  reports: Report[]; editing: boolean; scopeLabel: (r: Report) => string;
}) {
  return (
    <>
      {reports.map((r) => (
        <div className="linkcard" key={r.id}>
          <div>
            <div className="t">{r.title}</div>
            <div className="d">{[scopeLabel(r), r.period].filter(Boolean).join(" · ")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {editing && <RowTools kind="reports" record={r} label={`“${r.title}”`} />}
            <a className="btn primary small" href={r.url} target="_blank" rel="noreferrer">Open in Whatagraph ↗</a>
          </div>
        </div>
      ))}
    </>
  );
}

export function ReportTable({ reports, editing, scopeLabel }: {
  reports: Report[]; editing: boolean; scopeLabel: (r: Report) => string;
}) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Report</th><th>Period</th><th>Estates</th><th />{editing && <th />}</tr></thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td className="wrap">{r.title}</td>
              <td>{r.period}</td>
              <td>{scopeLabel(r)}</td>
              <td><a className="link" href={r.url} target="_blank" rel="noreferrer">View</a></td>
              {editing && <td className="tools"><RowTools kind="reports" record={r} label={`“${r.title}”`} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
