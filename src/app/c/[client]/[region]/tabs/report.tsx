import { DashboardLinks, ReportTable } from "@/components/report-links";
import type { Estate, Region, Report } from "@/lib/types";
import type { TabProps } from "./shared";

export function ReportTab({ list, region, selected, reports, estateName, editing }: TabProps & {
  region: Region; selected: Estate | null; reports: Report[];
}) {
  const ids = new Set(list.map((e) => e.id));
  // Filtered to an estate: that estate's links. Otherwise: the state's links and each estate's.
  const inScope = reports.filter((r) =>
    (r.estate_id && ids.has(r.estate_id)) || (!selected && r.region_id === region.id));
  const dashboards = inScope.filter((r) => r.kind === "whatagraph");
  const other = inScope.filter((r) => r.kind !== "whatagraph");
  const label = (r: Report) => (r.estate_id ? estateName.get(r.estate_id) ?? "" : `All ${region.code} estates`);
  const name = selected ? selected.name : region.name;

  return (
    <>
      <div className="panel">
        <div className="panel-h"><h3>{name} performance</h3><span className="hint">Opens in Whatagraph</span></div>
        {dashboards.length ? (
          <DashboardLinks reports={dashboards} editing={editing} scopeLabel={label} />
        ) : (
          <div className="empty">No Whatagraph dashboard has been linked for {name} yet.</div>
        )}
      </div>
      {other.length > 0 && (
        <div className="panel">
          <div className="panel-h"><h3>Post-campaign reports</h3></div>
          <ReportTable reports={other} editing={editing} scopeLabel={label} />
        </div>
      )}
    </>
  );
}
