import type { Metadata } from "next";
import { TopBar } from "@/components/topbar";
import { AddButton } from "@/components/editor";
import { DashboardLinks, ReportTable } from "@/components/report-links";
import { loadReports } from "@/lib/queries";
import { loadClientContext, requireViewer } from "@/lib/session";
import type { Report } from "@/lib/types";
import { one } from "@/lib/url";

export const metadata: Metadata = { title: "Reporting" };

export default async function ReportingPage({ params, searchParams }: PageProps<"/c/[client]/reporting">) {
  const { client: slug } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer();
  const ctx = await loadClientContext(slug);
  const editing = viewer.isAdmin && one(sp.edit) === "1";
  const reports = await loadReports(ctx.client.id);

  const regionCode = new Map(ctx.regions.map((r) => [r.id, r.code]));
  const estateName = new Map(ctx.estates.map((e) => [e.id, e.name]));
  const label = (r: Report) =>
    r.estate_id ? estateName.get(r.estate_id) ?? "" : r.region_id ? regionCode.get(r.region_id) ?? "" : "All";

  const accountDash = reports.filter((r) => r.kind === "whatagraph" && !r.region_id && !r.estate_id);
  const stateDash = reports.filter((r) => r.kind === "whatagraph" && (r.region_id || r.estate_id));
  const other = reports.filter((r) => r.kind !== "whatagraph");

  return (
    <>
      <TopBar title="Reporting" crumb="Dashboards and post-campaign reports"
        editHref={viewer.isAdmin ? `/c/${slug}/reporting` : undefined} editing={editing}>
        {editing && <AddButton kind="reports" label="Add report link" />}
      </TopBar>
      <main className="content">
        <div className="panel">
          <div className="panel-h"><h3>Account-wide performance</h3><span className="hint">Opens in Whatagraph</span></div>
          {accountDash.length
            ? <DashboardLinks reports={accountDash} editing={editing} scopeLabel={() => "All estates"} />
            : <div className="empty">No account-wide dashboard linked yet. Each state page has its own reporting tab.</div>}
        </div>
        {stateDash.length > 0 && (
          <div className="panel">
            <div className="panel-h"><h3>State and estate dashboards</h3></div>
            <DashboardLinks reports={stateDash} editing={editing} scopeLabel={label} />
          </div>
        )}
        <div className="panel">
          <div className="panel-h"><h3>Post-campaign reports</h3></div>
          {other.length
            ? <ReportTable reports={other} editing={editing} scopeLabel={label} />
            : <div className="empty">No post-campaign reports yet.</div>}
        </div>
      </main>
    </>
  );
}
