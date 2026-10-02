import { TopBar } from "@/components/topbar";
import { AddButton } from "@/components/editor";
import { fyLabel, fyOf, latest, moneyShort, pct, timeAgo } from "@/lib/format";
import { loadEstateContent, loadReports } from "@/lib/queries";
import { loadClientContext, requireViewer } from "@/lib/session";
import { one } from "@/lib/url";
import { OverviewTable, type OverviewRow } from "./overview-table";

export default async function Overview({ params, searchParams }: PageProps<"/c/[client]">) {
  const { client: slug } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer();
  const ctx = await loadClientContext(slug);
  const editing = viewer.isAdmin && one(sp.edit) === "1";
  const fy = fyOf(ctx.today);
  const base = `/c/${slug}`;

  const ids = ctx.estates.map((e) => e.id);
  const [{ budgets, live, material, flights }, reports] = await Promise.all([
    loadEstateContent(ctx.client.id, ids, fy),
    loadReports(ctx.client.id),
  ]);
  const regionCode = new Map(ctx.regions.map((r) => [r.id, r.code]));

  const rows: OverviewRow[] = ctx.estates.map((e) => {
    const b = budgets.filter((x) => x.estate_id === e.id);
    const m = material.filter((x) => x.estate_id === e.id);
    const lv = live.filter((x) => x.estate_id === e.id);
    const fl = flights.filter((x) => x.estate_id === e.id);
    const updated = latest(e.updated_at, ...b.map((x) => x.updated_at), ...m.map((x) => x.updated_at),
      ...lv.map((x) => x.updated_at), ...fl.map((x) => x.updated_at));
    return {
      estate: e,
      stateCode: regionCode.get(e.region_id) ?? "",
      approved: b.reduce((a, x) => a + Number(x.approved), 0),
      booked: b.reduce((a, x) => a + Number(x.booked), 0),
      channels: new Set(b.map((x) => x.channel_id)).size,
      live: lv.filter((x) => x.state === "live").length,
      dueSoon: m.filter((x) => x.state === "due_soon").length,
      overdue: m.filter((x) => x.state === "overdue").length,
      updated: `Updated ${timeAgo(updated)}`,
      reportUrl: reports.find((r) => r.estate_id === e.id && r.kind === "whatagraph")?.url ?? null,
    };
  });

  const A = rows.reduce((a, r) => a + r.approved, 0);
  const B = rows.reduce((a, r) => a + r.booked, 0);
  const liveN = rows.reduce((a, r) => a + r.live, 0);
  const dueN = rows.reduce((a, r) => a + r.dueSoon, 0);
  const odN = rows.reduce((a, r) => a + r.overdue, 0);

  return (
    <>
      <TopBar
        title="Overview"
        crumb="All estates, budgets, live material and what's due"
        editHref={viewer.isAdmin ? base : undefined}
        editing={editing}
      >
        {editing && <AddButton kind="estates" label="Add estate" />}
      </TopBar>
      <main className="content">
        <div className="stats">
          <div className="stat hero"><div className="n">{moneyShort(A)}</div><div className="l">Approved {fyLabel(fy)} budget</div></div>
          <div className="stat">
            <div className="n">{pct(B, A)}%</div>
            <div className="l">Booked · {moneyShort(B)}</div>
            <div className="meter"><i style={{ width: `${Math.min(pct(B, A), 100)}%` }} /></div>
          </div>
          <div className="stat"><div className="n">{liveN}</div><div className="l">Placements live now</div></div>
          <div className="stat"><div className="n">{dueN}</div><div className="l">Material due in 14 days</div></div>
          <div className={`stat${odN ? " warn" : ""}`}><div className="n">{odN}</div><div className="l">Material overdue</div></div>
        </div>
        <OverviewTable rows={rows} states={ctx.regions.map((r) => r.code)} base={base} editing={editing} />
      </main>
    </>
  );
}
