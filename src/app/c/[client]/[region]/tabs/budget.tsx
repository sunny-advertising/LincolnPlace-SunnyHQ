import { RowTools } from "@/components/editor";
import { Updated } from "@/components/updated";
import { fyLabel, money, pct } from "@/lib/format";
import type { Budget } from "@/lib/types";
import { lastEdit, type TabProps } from "./shared";

function Progress({ booked, approved }: { booked: number; approved: number }) {
  const p = pct(booked, approved);
  return (
    <>
      <span className="bar sm"><i style={{ width: `${Math.min(p, 100)}%` }} /></span>
      <span className="muted">{p}%</span>
    </>
  );
}

export function BudgetTab({ list, budgets, channelName, names, editing, fy }: TabProps & { budgets: Budget[] }) {
  const A = budgets.reduce((a, b) => a + Number(b.approved), 0);
  const B = budgets.reduce((a, b) => a + Number(b.booked), 0);
  const byChannel = new Map<string, number>();
  for (const b of budgets) {
    const n = channelName.get(b.channel_id) ?? "Other";
    byChannel.set(n, (byChannel.get(n) ?? 0) + Number(b.approved));
  }
  const edit = lastEdit(budgets, names);
  const cols = editing ? 6 : 5;

  return (
    <div className="grid2">
      <div className="panel">
        <div className="panel-h">
          <h3>Approved budget by estate</h3>
          <span className="hint"><Updated at={edit.at} by={edit.by} /></span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Estate / channel</th><th className="num">Approved</th><th className="num">Booked</th>
                <th>Progress</th><th className="num">Remaining</th>{editing && <th />}
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const rows = budgets
                  .filter((b) => b.estate_id === e.id)
                  .sort((a, z) => (channelName.get(a.channel_id) ?? "").localeCompare(channelName.get(z.channel_id) ?? ""));
                const a = rows.reduce((s, b) => s + Number(b.approved), 0);
                const bk = rows.reduce((s, b) => s + Number(b.booked), 0);
                return [
                  <tr key={e.id} className="total">
                    <td><b>{e.name}</b> <span className="muted">{e.code}</span></td>
                    <td className="num"><b>{money(a)}</b></td>
                    <td className="num"><b>{money(bk)}</b></td>
                    <td><Progress booked={bk} approved={a} /></td>
                    <td className="num"><b>{money(a - bk)}</b></td>
                    {editing && <td />}
                  </tr>,
                  ...rows.map((b) => (
                    <tr key={b.id}>
                      <td
                        style={{ paddingLeft: 34 }}
                        title={[b.approved_by && `Approved by ${b.approved_by}`, b.notes].filter(Boolean).join(" · ") || undefined}
                      >
                        {channelName.get(b.channel_id)}
                      </td>
                      <td className="num">{money(Number(b.approved))}</td>
                      <td className="num">{money(Number(b.booked))}</td>
                      <td><Progress booked={Number(b.booked)} approved={Number(b.approved)} /></td>
                      <td className="num">{money(Number(b.approved) - Number(b.booked))}</td>
                      {editing && <td className="tools"><RowTools kind="budgets" record={b} label={`${e.name} ${channelName.get(b.channel_id)} budget`} /></td>}
                    </tr>
                  )),
                  ...(rows.length ? [] : [
                    <tr key={e.id + "-empty"}><td colSpan={cols} className="muted" style={{ paddingLeft: 34 }}>No {fyLabel(fy)} budget entered yet.</td></tr>,
                  ]),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Summary</h3><span className="hint">{fyLabel(fy)}</span></div>
        <div className="kv">
          <div><span>Approved</span><b>{money(A)}</b></div>
          <div><span>Booked</span><b>{money(B)}</b></div>
          <div><span>Remaining</span><b>{money(A - B)}</b></div>
          {[...byChannel.entries()].sort((a, z) => z[1] - a[1]).map(([k, v]) => (
            <div key={k}><span>{k}</span><span>{money(v)}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
