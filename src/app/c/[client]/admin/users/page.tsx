import type { Metadata } from "next";
import { TopBar } from "@/components/topbar";
import { timeAgo } from "@/lib/format";
import { loadClientContext, requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserScope } from "@/lib/types";
import { InviteButton, UserActions, type ScopeOptions, type UserRowData } from "./access-dialogs";
import { UserSearch } from "./user-search";

export const metadata: Metadata = { title: "Users & access" };

const ROLE_LABEL = { admin: "Admin", staff: "Sunny staff", client: "Client" } as const;

export default async function UsersPage({ params }: PageProps<"/c/[client]/admin/users">) {
  const { client: slug } = await params;
  const viewer = await requireAdmin();
  const ctx = await loadClientContext(slug);
  const supabase = await createClient();

  const [{ data: profiles }, { data: scopes }] = await Promise.all([
    supabase.from("profiles").select("*").or(`client_id.is.null,client_id.eq.${ctx.client.id}`).order("role").order("email"),
    supabase.from("user_scopes").select("*").eq("client_id", ctx.client.id),
  ]);
  const users = (profiles ?? []) as Profile[];
  const allScopes = (scopes ?? []) as UserScope[];

  const regionName = new Map(ctx.regions.map((r) => [r.id, r.code]));
  const estateName = new Map(ctx.estates.map((e) => [e.id, e.name]));

  const rows = users.map((u) => {
    const s = allScopes.filter((x) => x.user_id === u.id);
    const data: UserRowData = {
      id: u.id, name: u.name, email: u.email, role: u.role, disabled: !!u.disabled_at, isSelf: u.id === viewer.uid,
      wholeClient: s.some((x) => !x.region_id && !x.estate_id),
      regionIds: s.flatMap((x) => (x.region_id ? [x.region_id] : [])),
      estateIds: s.flatMap((x) => (x.estate_id ? [x.estate_id] : [])),
    };
    const sees =
      u.role !== "client" ? "Everything"
        : data.wholeClient ? "All estates"
          : data.regionIds.length ? data.regionIds.map((id) => `${regionName.get(id)} estates`).join(", ")
            : data.estateIds.length ? data.estateIds.map((id) => estateName.get(id)).join(", ")
              : "Nothing yet";
    const status = u.disabled_at ? ["grey", "Disabled"] : u.last_sign_in_at ? ["green", "Active"] : ["gold", "Invited"];
    return { u, data, sees, status };
  });

  const opts: ScopeOptions = {
    clientId: ctx.client.id, clientSlug: ctx.client.slug, clientName: ctx.client.name,
    regions: ctx.regions.map(({ id, code, name }) => ({ id, code, name })),
    estates: ctx.estates.map(({ id, code, name, region_id }) => ({ id, code, name, region_id })),
  };

  return (
    <>
      <TopBar title="Users & access" crumb="Invite people and control what they can see" />
      <main className="content">
        <div className="toolbar">
          <UserSearch />
          <InviteButton opts={opts} />
        </div>
        <div className="panel">
          <div className="tbl-wrap">
            <table id="users">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Can see</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
              <tbody>
                {rows.map(({ u, data, sees, status }) => (
                  <tr key={u.id} data-search={`${u.name ?? ""} ${u.email}`.toLowerCase()}>
                    <td><b style={{ fontWeight: 500 }}>{u.name || "—"}</b>{data.isSelf && <span className="muted"> (you)</span>}</td>
                    <td className="muted">{u.email}</td>
                    <td><span className={`chip ${u.role === "client" ? "grey" : "gold"}`}>{ROLE_LABEL[u.role]}</span></td>
                    <td className="wrap">{sees}</td>
                    <td><span className={`chip ${status[0]}`}>{status[1]}</span></td>
                    <td className="muted">{u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : "—"}</td>
                    <td className="tools"><UserActions user={data} opts={opts} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="note">
          Admins edit content. Sunny staff see everything, including the Sunny team section. Clients see only the estates
          assigned to them, enforced by the database, not just hidden in the page. Sunny users are listed under every client.
        </p>
      </main>
    </>
  );
}
