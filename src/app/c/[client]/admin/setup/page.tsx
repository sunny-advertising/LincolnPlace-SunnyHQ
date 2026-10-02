import type { Metadata } from "next";
import { TopBar } from "@/components/topbar";
import { AddButton, RowTools } from "@/components/editor";
import { loadClientContext, requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Estates & channels" };

export default async function SetupPage({ params }: PageProps<"/c/[client]/admin/setup">) {
  const { client: slug } = await params;
  await requireAdmin();
  const ctx = await loadClientContext(slug);
  const regionName = new Map(ctx.regions.map((r) => [r.id, r.name]));

  return (
    <>
      <TopBar title="Estates & channels" crumb={`The structure behind ${ctx.client.name}'s pages`}>
        <AddButton kind="estates" label="Add estate" />
        <AddButton kind="channels" label="Add channel" />
        <AddButton kind="regions" label="Add state" />
      </TopBar>
      <main className="content">
        <div className="grid2">
          <div className="panel">
            <div className="panel-h"><h3>Estates</h3><span className="hint">{ctx.estates.length} estates</span></div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Code</th><th>Name</th><th>State</th><th>Subtitle</th><th className="num">Order</th><th /></tr></thead>
                <tbody>
                  {ctx.estates.map((e) => (
                    <tr key={e.id}>
                      <td><span className="badge">{e.code}</span></td>
                      <td><b style={{ fontWeight: 500 }}>{e.name}</b></td>
                      <td>{regionName.get(e.region_id)}</td>
                      <td className="muted">{e.subtitle}</td>
                      <td className="num muted">{e.sort_order}</td>
                      <td className="tools"><RowTools kind="estates" record={e} label={e.name} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="panel">
              <div className="panel-h"><h3>States</h3></div>
              <div className="tbl-wrap">
                <table>
                  <tbody>
                    {ctx.regions.map((r) => (
                      <tr key={r.id}>
                        <td><b style={{ fontWeight: 500 }}>{r.code}</b></td><td>{r.name}</td>
                        <td className="tools"><RowTools kind="regions" record={r} label={r.name} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-h"><h3>Channels</h3></div>
              <div className="tbl-wrap">
                <table>
                  <tbody>
                    {ctx.channels.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td className="tools"><RowTools kind="channels" record={c} label={c.name} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <p className="note">Deleting a state, estate or channel that still has budgets or material attached is blocked; remove those first.</p>
      </main>
    </>
  );
}
