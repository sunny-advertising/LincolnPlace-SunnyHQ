"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export type SidebarState = { code: string; name: string; estates: number; overdue: boolean };

export function Sidebar(props: {
  clientSlug: string;
  clientName: string;
  clients: { slug: string; name: string }[];
  states: SidebarState[];
  role: "admin" | "staff" | "client";
  userLabel: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const base = `/c/${props.clientSlug}`;
  const isStaff = props.role !== "client";

  const nav = (href: string, label: React.ReactNode, extra?: React.ReactNode, exact = false) => {
    const active = exact ? path === href : path === href || path.startsWith(href + "/");
    return (
      <Link key={href} href={href} className={`nav${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
        <span>{label}</span>
        {extra}
      </Link>
    );
  };

  return (
    <aside className="side">
      <div className="brand">
        <div className="wm">Sunny<span>.</span> {props.clientName}</div>
        <div className="sub">Media portal</div>
        {props.clients.length > 1 && (
          <select
            aria-label="Switch client"
            value={props.clientSlug}
            onChange={(e) => router.push(`/c/${e.target.value}`)}
          >
            {props.clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        )}
      </div>

      <nav className="navgroup" aria-label="Main">
        {nav(base, "Overview", null, true)}
        {nav(`${base}/reporting`, "Reporting")}
        {nav(`${base}/sheets`, "Sheets & links")}
        {nav(`${base}/contacts`, "Key dates & contacts")}
      </nav>

      {props.states.length > 0 && (
        <nav className="navgroup" aria-label="States">
          <div className="navhead">States</div>
          {props.states.map((s) =>
            nav(
              `${base}/${s.code.toLowerCase()}`,
              <>
                {s.name}
                {s.overdue && <i className="dot" aria-label="has overdue items" />}
              </>,
              <span className="code">{s.estates} {s.estates === 1 ? "estate" : "estates"}</span>,
            ),
          )}
        </nav>
      )}

      {isStaff && (
        <nav className="navgroup" aria-label="Sunny team">
          <div className="navhead">Sunny team <span className="lock">Staff only</span></div>
          {nav(`${base}/team/sops`, "Processes & SOPs")}
          {nav(`${base}/team/specs`, "Specs & deadlines")}
          {nav(`${base}/team/notes`, "Internal notes")}
        </nav>
      )}

      {props.role === "admin" && (
        <nav className="navgroup" aria-label="Admin">
          <div className="navhead">Admin</div>
          {nav(`${base}/admin/users`, "Users & access")}
          {nav(`${base}/admin/setup`, "Estates & channels")}
        </nav>
      )}

      <div className="side-foot">
        <div className="who">{props.userLabel}</div>
        <div className="row">
          <form action="/auth/signout" method="post">
            <button className="textbtn" type="submit">Sign out</button>
          </form>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
