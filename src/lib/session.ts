import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/format";
import type { Channel, Client, Estate, Profile, Region } from "@/lib/types";

export type Viewer = {
  uid: string;
  email: string;
  profile: Profile;
  isAdmin: boolean;
  isStaff: boolean;
};

/** The signed-in user and their profile, or a redirect to /login or /no-access. */
export const requireViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle<Profile>();
  if (!profile || profile.disabled_at) redirect("/no-access");

  return {
    uid,
    email: (data.claims.email as string) ?? profile.email,
    profile,
    isAdmin: profile.role === "admin",
    isStaff: profile.role === "admin" || profile.role === "staff",
  };
});

export type ClientContext = {
  client: Client;
  clients: Client[];
  regions: Region[];
  estates: Estate[];
  channels: Channel[];
  today: string;
};

/** Everything the shell needs for one client. RLS trims regions/estates to the viewer's scope. */
export const loadClientContext = cache(async (slug: string): Promise<ClientContext> => {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id,name,slug,timezone").order("name");
  const client = (clients ?? []).find((c) => c.slug === slug) as Client | undefined;
  if (!client) notFound();

  const [regions, estates, channels] = await Promise.all([
    supabase.from("regions").select("*").eq("client_id", client.id).order("sort_order"),
    supabase.from("estates").select("*").eq("client_id", client.id).order("sort_order"),
    supabase.from("channels").select("*").eq("client_id", client.id).order("sort_order"),
  ]);

  return {
    client,
    clients: (clients ?? []) as Client[],
    regions: (regions.data ?? []) as Region[],
    estates: (estates.data ?? []) as Estate[],
    channels: (channels.data ?? []) as Channel[],
    today: todayIn(client.timezone),
  };
});

/** For staff-only pages. RLS already hides the data; this gives a clean 404 instead of an empty page. */
export async function requireStaff() {
  const viewer = await requireViewer();
  if (!viewer.isStaff) notFound();
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();
  return viewer;
}
