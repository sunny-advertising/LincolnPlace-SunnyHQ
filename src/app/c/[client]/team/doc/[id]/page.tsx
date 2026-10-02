import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/topbar";
import { RowTools } from "@/components/editor";
import { Markdown } from "@/components/markdown";
import { Updated } from "@/components/updated";
import { loadNames } from "@/lib/queries";
import { loadClientContext, requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { InternalDoc } from "@/lib/types";
import { one } from "@/lib/url";

const SECTION_TITLE = { sops: "Processes & SOPs", specs: "Specs & deadlines", notes: "Internal notes" } as const;

export default async function DocPage({ params, searchParams }: PageProps<"/c/[client]/team/doc/[id]">) {
  const { client: slug, id } = await params;
  const sp = await searchParams;
  const viewer = await requireStaff();
  await loadClientContext(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("internal_docs").select("*").eq("id", id).maybeSingle<InternalDoc>();
  if (!data) notFound();
  const names = await loadNames([data.updated_by]);
  const editing = viewer.isAdmin && one(sp.edit) === "1";
  const back = `/c/${slug}/team/${data.section}`;

  return (
    <>
      <TopBar
        title={data.title}
        crumb={<><Link className="link" href={back}>{SECTION_TITLE[data.section]}</Link> / {data.title}</>}
        editHref={viewer.isAdmin ? `/c/${slug}/team/doc/${id}` : undefined}
        editing={editing}
      />
      <main className="content">
        <div className="banner">Sunny staff only. Clients never see this section.</div>
        <div className="panel">
          <div className="panel-h">
            <h3>{data.summary ?? data.title}</h3>
            <span className="hint">
              {data.url && <a className="link" href={data.url} target="_blank" rel="noreferrer">Open link ↗</a>}
              <Updated at={data.updated_at} by={data.updated_by ? names.get(data.updated_by) : null} />
              {editing && <RowTools kind="internal_docs" record={data} label={`“${data.title}”`} />}
            </span>
          </div>
          {data.body_md.trim() ? <Markdown>{data.body_md}</Markdown> : <div className="empty">This document is empty.</div>}
        </div>
      </main>
    </>
  );
}
