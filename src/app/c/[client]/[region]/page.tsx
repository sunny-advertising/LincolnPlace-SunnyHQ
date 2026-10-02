import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/topbar";
import { AddButton } from "@/components/editor";
import type { ContentKind } from "@/lib/content";
import { fyLabel, fyOf } from "@/lib/format";
import { loadEstateContent, loadFys, loadNames, loadReports } from "@/lib/queries";
import { loadClientContext, requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { InternalDoc } from "@/lib/types";
import { one, withQuery } from "@/lib/url";
import { BudgetTab } from "./tabs/budget";
import { PlanTab } from "./tabs/plan";
import { LiveTab } from "./tabs/live";
import { DueTab } from "./tabs/due";
import { ReportTab } from "./tabs/report";
import { InternalTab } from "./tabs/internal";

const TABS = [
  { key: "budget", label: "Budget", kind: "budgets" },
  { key: "plan", label: "Media plan", kind: "flights" },
  { key: "live", label: "Live material", kind: "live_placements" },
  { key: "due", label: "Material due", kind: "material_due" },
  { key: "report", label: "Reporting", kind: "reports" },
  { key: "internal", label: "Internal notes", kind: "internal_docs", staff: true },
] as const satisfies readonly { key: string; label: string; kind: ContentKind; staff?: boolean }[];

export default async function StatePage({ params, searchParams }: PageProps<"/c/[client]/[region]">) {
  const { client: slug, region: regionCode } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer();
  const ctx = await loadClientContext(slug);

  const region = ctx.regions.find((r) => r.code.toLowerCase() === regionCode.toLowerCase());
  if (!region) notFound();

  const tabs = TABS.filter((t) => !("staff" in t) || viewer.isStaff);
  const tab = tabs.find((t) => t.key === one(sp.tab)) ?? tabs[0];
  const all = ctx.estates.filter((e) => e.region_id === region.id);
  const selected = all.find((e) => e.code === one(sp.estate)) ?? null;
  const list = selected ? [selected] : all;
  const currentFy = fyOf(ctx.today);
  const fy = Number(one(sp.fy)) || currentFy;
  const editing = viewer.isAdmin && one(sp.edit) === "1";
  const path = `/c/${slug}/${region.code.toLowerCase()}`;

  const [content, fys, reports] = await Promise.all([
    loadEstateContent(ctx.client.id, list.map((e) => e.id), fy),
    loadFys(ctx.client.id, currentFy),
    tab.key === "report" ? loadReports(ctx.client.id) : Promise.resolve([]),
  ]);

  let docs: InternalDoc[] = [];
  if (tab.key === "internal") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("internal_docs").select("*")
      .eq("client_id", ctx.client.id).eq("section", "notes").eq("region_id", region.id)
      .order("sort_order").order("title");
    docs = (data ?? []) as InternalDoc[];
  }

  const names = await loadNames([
    ...content.budgets.map((b) => b.updated_by), ...content.flights.map((b) => b.updated_by),
    ...content.live.map((b) => b.updated_by), ...content.material.map((b) => b.updated_by),
    ...docs.map((d) => d.updated_by),
  ]);

  // The header count covers the whole state even when filtered to one estate.
  let overdueAll = content.material.filter((m) => m.state === "overdue").length;
  if (selected && all.length > 1) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("material_due_v").select("id", { count: "exact", head: true })
      .eq("client_id", ctx.client.id).eq("state", "overdue").in("estate_id", all.map((e) => e.id));
    overdueAll = count ?? overdueAll;
  }

  const channelName = new Map(ctx.channels.map((c) => [c.id, c.name]));
  const estateName = new Map(all.map((e) => [e.id, e.name]));
  const shared = { list, channelName, estateName, names, editing, today: ctx.today, fy };
  const showFy = tab.key === "budget" || tab.key === "plan";

  return (
    <>
      <TopBar
        title={region.name}
        crumb={selected ? `${region.name} / ${selected.name}` : `All ${region.code} estates`}
        editHref={viewer.isAdmin ? withQuery(path, sp, { edit: undefined }) : undefined}
        editing={editing}
      />
      <main className="content">
        <div className="ehead">
          <div>
            <div className="big">{region.name}</div>
            <div className="meta">
              {all.length} {all.length === 1 ? "estate" : "estates"} · {fyLabel(fy)}
              {overdueAll > 0 && <> · <span className="chip red">{overdueAll} overdue</span></>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {showFy && fys.length > 1 && (
              <div className="seg" role="group" aria-label="Financial year">
                {fys.map((y) => (
                  <Link key={y} className={y === fy ? "on" : ""} href={withQuery(path, sp, { fy: y === currentFy ? undefined : String(y) })} scroll={false}>
                    {fyLabel(y)}
                  </Link>
                ))}
              </div>
            )}
            <a className="btn small" href={withQuery(`${path}/media-plan`, {}, { estate: selected?.code, fy: String(fy) })}>
              Download media plan
            </a>
            {editing && (
              <AddButton
                kind={tab.kind}
                label="Add item"
                defaults={
                  tab.kind === "internal_docs"
                    ? { section: "notes", region_id: region.id }
                    : tab.kind === "reports"
                      ? selected ? { estate_id: selected.id } : { region_id: region.id }
                      : { estate_id: selected?.id, fy }
                }
              />
            )}
          </div>
        </div>

        {all.length > 1 && (
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Filter by estate">
              <Link className={!selected ? "on" : ""} href={withQuery(path, sp, { estate: undefined })} scroll={false}>All estates</Link>
              {all.map((e) => (
                <Link key={e.id} className={selected?.id === e.id ? "on" : ""} href={withQuery(path, sp, { estate: e.code })} scroll={false}>
                  {e.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <Link
              key={t.key}
              role="tab"
              aria-selected={t.key === tab.key}
              className={`tab${t.key === tab.key ? " on" : ""}`}
              href={withQuery(path, sp, { tab: t.key === "budget" ? undefined : t.key })}
              scroll={false}
            >
              {t.label}
              {"staff" in t && <> <span className="chip grey">Staff</span></>}
            </Link>
          ))}
        </div>

        {tab.key === "budget" && <BudgetTab {...shared} budgets={content.budgets} />}
        {tab.key === "plan" && <PlanTab {...shared} flights={content.flights} />}
        {tab.key === "live" && <LiveTab {...shared} live={content.live} />}
        {tab.key === "due" && <DueTab {...shared} material={content.material} />}
        {tab.key === "report" && (
          <ReportTab {...shared} region={region} selected={selected} reports={reports} />
        )}
        {tab.key === "internal" && <InternalTab {...shared} region={region} docs={docs} />}
      </main>
    </>
  );
}
