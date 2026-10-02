import { RowTools } from "@/components/editor";
import { Markdown } from "@/components/markdown";
import { Updated } from "@/components/updated";
import type { InternalDoc, Region } from "@/lib/types";
import type { TabProps } from "./shared";

export function InternalTab({ region, docs, names, editing }: TabProps & { region: Region; docs: InternalDoc[] }) {
  return (
    <>
      <div className="banner">Only Sunny staff can see this tab.</div>
      {docs.map((d) => (
        <div className="panel" key={d.id}>
          <div className="panel-h">
            <h3>{d.title}</h3>
            <span className="hint">
              {d.url && <a className="link" href={d.url} target="_blank" rel="noreferrer">Open link ↗</a>}
              <Updated at={d.updated_at} by={d.updated_by ? names.get(d.updated_by) : null} />
              {editing && <RowTools kind="internal_docs" record={d} label={`“${d.title}”`} />}
            </span>
          </div>
          {d.body_md.trim() ? <Markdown>{d.body_md}</Markdown> : <div className="empty">{d.summary ?? "No notes yet."}</div>}
        </div>
      ))}
      {!docs.length && (
        <div className="panel"><div className="empty">No internal notes for {region.name} yet.</div></div>
      )}
    </>
  );
}
