import type { Metadata } from "next";
import { TopBar } from "@/components/topbar";
import { AddButton, RowTools } from "@/components/editor";
import { Updated } from "@/components/updated";
import { loadClientContext, requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { SheetLink } from "@/lib/types";
import { one } from "@/lib/url";

export const metadata: Metadata = { title: "Sheets & links" };

function host(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h === "docs.google.com") return url.includes("/spreadsheets/") ? "Google Sheets" : "Google Docs";
    if (h === "drive.google.com") return "Google Drive";
    return h;
  } catch {
    return "";
  }
}

export default async function SheetsPage({ params, searchParams }: PageProps<"/c/[client]/sheets">) {
  const { client: slug } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer();
  const ctx = await loadClientContext(slug);
  const editing = viewer.isAdmin && one(sp.edit) === "1";

  const supabase = await createClient();
  const { data } = await supabase.from("sheet_links").select("*").eq("client_id", ctx.client.id)
    .order("sort_order").order("title");
  const links = (data ?? []) as SheetLink[];

  const groups: { key: string; title: string; items: SheetLink[] }[] = [
    { key: "all", title: "Account-wide", items: links.filter((l) => !l.region_id && !l.estate_id) },
    ...ctx.regions.map((r) => ({
      key: r.id,
      title: r.name,
      items: links.filter((l) => l.region_id === r.id ||
        (l.estate_id && ctx.estates.find((e) => e.id === l.estate_id)?.region_id === r.id)),
    })),
  ].filter((g) => g.items.length);
  const estateName = new Map(ctx.estates.map((e) => [e.id, e.name]));

  return (
    <>
      <TopBar title="Sheets & links" crumb="The working sheets behind this portal"
        editHref={viewer.isAdmin ? `/c/${slug}/sheets` : undefined} editing={editing}>
        {editing && <AddButton kind="sheet_links" label="Add sheet" />}
      </TopBar>
      <main className="content">
        {groups.map((g) => (
          <section key={g.key}>
            <div className="section-h">{g.title}</div>
            <div className="docs">
              {g.items.map((l) => (
                <div className="doc" key={l.id}>
                  {editing && <div className="tools"><RowTools kind="sheet_links" record={l} label={`“${l.title}”`} /></div>}
                  <a className="t stretch" href={l.url} target="_blank" rel="noreferrer">{l.title}</a>
                  {l.description && <div className="d">{l.description}</div>}
                  <div className="f">
                    <span>{[host(l.url), l.estate_id ? estateName.get(l.estate_id) : null].filter(Boolean).join(" · ")}</span>
                    {l.staff_only ? <span className="chip grey">Staff only</span> : <Updated at={l.updated_at} />}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {!groups.length && (
          <div className="panel"><div className="empty">No sheets linked yet.{viewer.isAdmin ? " Use Edit page → Add sheet." : ""}</div></div>
        )}
      </main>
    </>
  );
}
