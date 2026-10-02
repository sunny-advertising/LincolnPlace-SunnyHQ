import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Budget, Flight, LivePlacement, MaterialDue, Report } from "@/lib/types";

/** Content rows for a set of estates. RLS still applies; the filter just narrows to the page. */
export async function loadEstateContent(clientId: string, estateIds: string[], fy: number) {
  const supabase = await createClient();
  if (!estateIds.length) {
    return { budgets: [] as Budget[], flights: [] as Flight[], live: [] as LivePlacement[], material: [] as MaterialDue[] };
  }
  const [budgets, flights, live, material] = await Promise.all([
    supabase.from("budgets").select("*").eq("client_id", clientId).eq("fy", fy).in("estate_id", estateIds),
    supabase.from("flights").select("*").eq("client_id", clientId).eq("fy", fy).in("estate_id", estateIds).order("start_date"),
    supabase.from("live_placements_v").select("*").eq("client_id", clientId).in("estate_id", estateIds).order("live_from"),
    supabase.from("material_due_v").select("*").eq("client_id", clientId).in("estate_id", estateIds).order("due_date"),
  ]);
  return {
    budgets: (budgets.data ?? []) as Budget[],
    flights: (flights.data ?? []) as Flight[],
    live: (live.data ?? []) as LivePlacement[],
    material: (material.data ?? []) as MaterialDue[],
  };
}

export async function loadReports(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("reports").select("*").eq("client_id", clientId).order("sort_order").order("title");
  return (data ?? []) as Report[];
}

/** Display names for updated_by ids (RLS lets everyone see Sunny staff names). */
export async function loadNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,name,email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, (p.name as string) || (p.email as string).split("@")[0]]));
}

/** Available FYs for budgets/flights, always including the current one. */
export async function loadFys(clientId: string, current: number) {
  const supabase = await createClient();
  const [b, f] = await Promise.all([
    supabase.from("budgets").select("fy").eq("client_id", clientId),
    supabase.from("flights").select("fy").eq("client_id", clientId),
  ]);
  const set = new Set<number>([current]);
  for (const r of [...(b.data ?? []), ...(f.data ?? [])]) set.add(r.fy as number);
  return [...set].sort((a, z) => a - z);
}
