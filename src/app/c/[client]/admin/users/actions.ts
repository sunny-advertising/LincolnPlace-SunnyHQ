"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import type { Role, ScopeEntry } from "@/lib/types";

export type AccessState = { error?: string; link?: string; email?: string; message?: string; done?: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = ["admin", "staff", "client"];

/** Reads role + scope fields shared by the invite and edit-access forms. */
function readAccess(form: FormData): { role: Role; scope: ScopeEntry[] } | { error: string } {
  const role = String(form.get("role") ?? "") as Role;
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  if (role !== "client") return { role, scope: [] };

  const mode = String(form.get("scope_mode") ?? "all");
  if (mode === "all") return { role, scope: [{ region_id: null, estate_id: null }] };
  if (mode === "regions") {
    const ids = form.getAll("region_ids").map(String).filter(Boolean);
    if (!ids.length) return { error: "Tick at least one state." };
    return { role, scope: ids.map((id) => ({ region_id: id, estate_id: null })) };
  }
  const ids = form.getAll("estate_ids").map(String).filter(Boolean);
  if (!ids.length) return { error: "Tick at least one estate." };
  return { role, scope: ids.map((id) => ({ region_id: null, estate_id: id })) };
}

/** One-time sign-in link via the service role. Lands on /auth/confirm, which needs a button press. */
async function signInLink(email: string): Promise<{ link: string; userId: string } | { error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) return { error: error?.message ?? "Couldn't create a sign-in link." };
  const link = `${siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=/`;
  return { link, userId: data.user.id };
}

/** Records an invite and applies it to the user (creating the auth user if needed). */
async function grant(form: FormData, email: string, name: string | null): Promise<AccessState> {
  const viewer = await requireAdmin();
  const access = readAccess(form);
  if ("error" in access) return { error: access.error };
  const clientId = String(form.get("client_id") ?? "");

  const supabase = await createClient();
  const { data: invite, error: invErr } = await supabase
    .from("invites")
    .insert({
      email, name, role: access.role,
      client_id: access.role === "client" ? clientId : null,
      scope: access.scope, created_by: viewer.uid,
    })
    .select("id")
    .single();
  if (invErr || !invite) return { error: invErr?.message ?? "Couldn't record the invite." };

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: name ? { name } : undefined });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    return { error: created.error.message };
  }

  const link = await signInLink(email);
  if ("error" in link) return { error: link.error };
  const { error: applyErr } = await admin.rpc("apply_invite", { p_invite_id: invite.id, p_user_id: link.userId });
  if (applyErr) return { error: applyErr.message };

  return { link: link.link, email };
}

export async function inviteUser(_prev: AccessState, form: FormData): Promise<AccessState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim() || null;
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const res = await grant(form, email, name);
  revalidatePath(`/c/${String(form.get("client_slug") ?? "")}/admin/users`);
  return res;
}

export async function updateAccess(_prev: AccessState, form: FormData): Promise<AccessState> {
  const viewer = await requireAdmin();
  const userId = String(form.get("user_id") ?? "");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id,email,name").eq("id", userId).maybeSingle();
  if (!profile) return { error: "User not found." };
  if (userId === viewer.uid && form.get("role") !== "admin") {
    return { error: "You can't remove your own admin access. Ask another admin." };
  }

  const access = readAccess(form);
  if ("error" in access) return { error: access.error };
  const clientId = String(form.get("client_id") ?? "");
  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      email: profile.email, name: profile.name, role: access.role,
      client_id: access.role === "client" ? clientId : null,
      scope: access.scope, created_by: viewer.uid, user_id: userId, accepted_at: new Date().toISOString(),
    })
    .select("id").single();
  if (error || !invite) return { error: error?.message ?? "Couldn't save." };

  const { error: applyErr } = await createAdminClient().rpc("apply_invite", { p_invite_id: invite.id, p_user_id: userId });
  if (applyErr) return { error: applyErr.message };
  revalidatePath(`/c/${String(form.get("client_slug") ?? "")}/admin/users`);
  return { message: "Access updated.", done: Date.now() };
}

export async function resendLink(userId: string): Promise<AccessState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("email,disabled_at").eq("id", userId).maybeSingle();
  if (!profile) return { error: "User not found." };
  if (profile.disabled_at) return { error: "This user is disabled. Enable them first." };
  const link = await signInLink(profile.email);
  return "error" in link ? { error: link.error } : { link: link.link, email: profile.email };
}

export async function setDisabled(userId: string, disabled: boolean, clientSlug: string): Promise<AccessState> {
  const viewer = await requireAdmin();
  if (userId === viewer.uid) return { error: "You can't disable your own account." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles").update({ disabled_at: disabled ? new Date().toISOString() : null }).eq("id", userId);
  if (error) return { error: error.message };
  // RLS checks disabled_at on every query, so a disabled user sees nothing from their next request.
  revalidatePath(`/c/${clientSlug}/admin/users`);
  return { message: disabled ? "User disabled." : "User enabled.", done: Date.now() };
}
