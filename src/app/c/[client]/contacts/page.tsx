import type { Metadata } from "next";
import { TopBar } from "@/components/topbar";
import { AddButton, RowTools } from "@/components/editor";
import { addDays, parseDate, shortDate } from "@/lib/format";
import { loadClientContext, requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Contact, KeyDate } from "@/lib/types";
import { one } from "@/lib/url";

export const metadata: Metadata = { title: "Key dates & contacts" };

const ORG_TITLE: Record<Contact["org"], string> = { sunny: "Your Sunny team", client: "Client contacts", vendor: "Vendor contacts" };

export default async function ContactsPage({ params, searchParams }: PageProps<"/c/[client]/contacts">) {
  const { client: slug } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer();
  const ctx = await loadClientContext(slug);
  const editing = viewer.isAdmin && one(sp.edit) === "1";
  const supabase = await createClient();

  // Upcoming dates plus the last fortnight, so recent deadlines don't vanish the day after.
  const [dates, contacts] = await Promise.all([
    supabase.from("key_dates").select("*").eq("client_id", ctx.client.id).gte("date", addDays(ctx.today, -14)).order("date"),
    supabase.from("contacts").select("*").eq("client_id", ctx.client.id).order("sort_order").order("name"),
  ]);
  const keyDates = (dates.data ?? []) as KeyDate[];
  const people = (contacts.data ?? []) as Contact[];

  const regionCode = new Map(ctx.regions.map((r) => [r.id, r.code]));
  const estateName = new Map(ctx.estates.map((e) => [e.id, e.name]));
  const year = parseDate(ctx.today).getUTCFullYear();
  const orgs = (["sunny", "client", "vendor"] as const).filter((o) => people.some((p) => p.org === o) || (o === "sunny"));

  return (
    <>
      <TopBar title="Key dates & contacts" crumb="Deadlines and your Sunny team"
        editHref={viewer.isAdmin ? `/c/${slug}/contacts` : undefined} editing={editing}>
        {editing && <><AddButton kind="key_dates" label="Add date" /><AddButton kind="contacts" label="Add contact" /></>}
      </TopBar>
      <main className="content">
        <div className="grid2">
          <div className="panel">
            <div className="panel-h"><h3>Key dates</h3></div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Date</th><th>What</th><th>Estates</th>{editing && <th />}</tr></thead>
                <tbody>
                  {keyDates.map((d) => (
                    <tr key={d.id} style={d.date < ctx.today ? { opacity: 0.55 } : undefined}>
                      <td><b style={{ fontWeight: 500 }}>{shortDate(d.date, year)}</b></td>
                      <td className="wrap">{d.title}{d.notes && <div className="muted" style={{ fontSize: 12 }}>{d.notes}</div>}</td>
                      <td>{d.estate_id ? estateName.get(d.estate_id) : d.region_id ? regionCode.get(d.region_id) : "All"}</td>
                      {editing && <td className="tools"><RowTools kind="key_dates" record={d} label={`“${d.title}”`} /></td>}
                    </tr>
                  ))}
                  {!keyDates.length && <tr><td colSpan={editing ? 4 : 3} className="empty">No upcoming dates.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            {orgs.map((o) => {
              const list = people.filter((p) => p.org === o);
              return (
                <div className="panel" key={o} style={{ marginBottom: 16 }}>
                  <div className="panel-h"><h3>{ORG_TITLE[o]}</h3></div>
                  <div className="kv">
                    {list.map((p) => (
                      <div key={p.id}>
                        <span>{p.role_title}</span>
                        <span style={{ textAlign: "right" }}>
                          {p.name}
                          {p.email && <> · <a className="link" href={`mailto:${p.email}`}>{p.email}</a></>}
                          {p.phone && <> · <a className="link" href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a></>}
                          {editing && <> <RowTools kind="contacts" record={p} label={p.name} /></>}
                        </span>
                      </div>
                    ))}
                    {!list.length && <div><span className="muted">No contacts added yet.</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
