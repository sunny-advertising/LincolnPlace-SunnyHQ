"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RowTools } from "@/components/editor";
import { money } from "@/lib/format";
import type { Estate } from "@/lib/types";

export type OverviewRow = {
  estate: Estate;
  stateCode: string;
  approved: number;
  booked: number;
  channels: number;
  live: number;
  dueSoon: number;
  overdue: number;
  updated: string;
  reportUrl: string | null;
};

export function OverviewTable({ rows, states, base, editing }: {
  rows: OverviewRow[]; states: string[]; base: string; editing: boolean;
}) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("All");
  const router = useRouter();

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) =>
      (st === "All" || r.stateCode === st) &&
      (!needle || r.estate.name.toLowerCase().includes(needle) || r.estate.code.toLowerCase().includes(needle) ||
        (r.estate.subtitle ?? "").toLowerCase().includes(needle)));
  }, [rows, q, st]);

  const open = (r: OverviewRow) => router.push(`${base}/${r.stateCode.toLowerCase()}?estate=${encodeURIComponent(r.estate.code)}`);

  return (
    <>
      <div className="toolbar">
        <input className="search" placeholder="Search estates…" aria-label="Search estates" value={q} onChange={(e) => setQ(e.target.value)} />
        {states.length > 1 && (
          <div className="seg" role="group" aria-label="Filter by state">
            {["All", ...states].map((s) => (
              <button key={s} type="button" className={s === st ? "on" : ""} aria-pressed={s === st} onClick={() => setSt(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>
      <div className="panel">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Estate</th><th>Budget booked</th><th className="num">Approved</th><th className="num">Live</th>
                <th>Material</th><th>Reporting</th>{editing && <th />}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const p = r.approved > 0 ? Math.round((r.booked / r.approved) * 100) : 0;
                return (
                  <tr key={r.estate.id} className="click" onClick={() => open(r)}
                    onKeyDown={(e) => e.key === "Enter" && open(r)} tabIndex={0}>
                    <td>
                      <div className="est">
                        <div className="badge">{r.estate.code}</div>
                        <div>
                          <div className="nm">{r.estate.name}</div>
                          <div className="mt">
                            {r.stateCode}{r.estate.subtitle ? ` · ${r.estate.subtitle}` : ""} · {r.channels} {r.channels === 1 ? "channel" : "channels"} · {r.updated}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="bar"><i style={{ width: `${Math.min(p, 100)}%` }} /></span>
                      <span className="muted">{p}%</span>
                    </td>
                    <td className="num">{money(r.approved)}</td>
                    <td className="num">{r.live}</td>
                    <td>
                      {r.overdue > 0 && <><span className="chip red">{r.overdue} overdue</span>{" "}</>}
                      {r.dueSoon > 0 && <span className="chip gold">{r.dueSoon} due soon</span>}
                      {!r.overdue && !r.dueSoon && <span className="chip green">All supplied</span>}
                    </td>
                    <td>
                      {r.reportUrl ? (
                        <a className="link" href={r.reportUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          Whatagraph
                        </a>
                      ) : <span className="muted">—</span>}
                    </td>
                    {editing && (
                      <td className="tools"><RowTools kind="estates" record={r.estate} label={r.estate.name} /></td>
                    )}
                  </tr>
                );
              })}
              {!list.length && (
                <tr><td colSpan={editing ? 7 : 6} className="empty">No estates match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
