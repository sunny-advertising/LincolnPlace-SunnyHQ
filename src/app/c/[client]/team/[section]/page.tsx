import { notFound } from "next/navigation";
import { TopBar } from "@/components/topbar";
import { AddButton, RowTools } from "@/components/editor";
import { timeAgo } from "@/lib/format";
import { loadClientContext, requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { InternalDoc } from "@/lib/types";
import { one } from "@/lib/url";

const SECTIONS = {
  sops: { title: "Processes & SOPs", crumb: (c: string) => `How we run the ${c} account` },
  specs: { title: "Specs & deadlines", crumb: () => "Material specs and the master specs sheet" },
  notes: { title: "Internal notes", crumb: () => "Account context for the Sunny team" },
} as const;

export async function generateMetadata({ params }: PageProps<"/c/[client]/team/[section]">) {
  const { section } = await params;
  return { title: SECTIONS[section as keyof typeof SECTIONS]?.title ?? "Sunny team" };
}

export default async function TeamSection({ params, searchParams }: PageProps<"/c/[client]/team/[section]">) {
  const { client: slug, section } = await params;
  if (!(section in SECTIONS)) notFound();
  const meta = SECTIONS[section as keyof typeof SECTIONS];
  const sp = await searchParams;
  const viewer = await requireStaff();
  const ctx = await loadClientContext(slug);
  const editing = viewer.isAdmin && one(sp.edit) === "1";

  const supabase = await createClient();
  const { data } = await supabase
    .from("internal_docs").select("*").eq("section", section)
    .or(`client_id.eq.${ctx.client.id},client_id.is.null`)
    .order("sort_order").order("title");
  const docs = (data ?? []) as InternalDoc[];
  const regionName = new Map(ctx.regions.map((r) => [r.id, r.name]));
  const base = `/c/${slug}/team`;

  return (
    <>
      <TopBar title={meta.title} crumb={meta.crumb(ctx.client.name)}
        editHref={viewer.isAdmin ? `${base}/${section}` : undefined} editing={editing}>
        {editing && <AddButton kind="internal_docs" label="Add document" defaults={{ section }} />}
      </TopBar>
      <main className="content">
        <div className="banner">Sunny staff only. Clients never see this section.</div>
        <div className="docs">
          {docs.map((d) => {
            const href = d.url && !d.body_md.trim() ? d.url : `${base}/doc/${d.id}`;
            const external = href.startsWith("http");
            return (
              <div className="doc" key={d.id}>
                {editing && <div className="tools"><RowTools kind="internal_docs" record={d} label={`“${d.title}”`} /></div>}
                <a className="t stretch" href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{d.title}</a>
                {d.summary && <div className="d">{d.summary}</div>}
                <div className="f">
                  <span>
                    {external ? "External link ↗" : `Updated ${timeAgo(d.updated_at)}`}
                    {d.region_id ? ` · ${regionName.get(d.region_id) ?? ""}` : ""}
                  </span>
                  {d.client_id === null && <span className="chip grey">Agency-wide</span>}
                </div>
              </div>
            );
          })}
        </div>
        {!docs.length && <div className="panel"><div className="empty">Nothing here yet.</div></div>}
      </main>
    </>
  );
}
