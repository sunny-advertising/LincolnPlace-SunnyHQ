"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";
import { CONTENT, isContentKind, type Field } from "@/lib/content";

export type SaveState = { ok?: boolean; error?: string; savedAt?: number };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function coerce(field: Field, raw: FormDataEntryValue | null): { value: unknown; error?: string } {
  if (field.type === "checkbox") return { value: raw === "on" || raw === "true" };
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "") {
    return field.required ? { value: null, error: `${field.label} is required.` } : { value: null };
  }
  switch (field.type) {
    case "number":
    case "fy": {
      const n = Number(s);
      if (!Number.isInteger(n)) return { value: null, error: `${field.label} must be a whole number.` };
      return { value: n };
    }
    case "money": {
      const n = Number(s.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0) return { value: null, error: `${field.label} must be a positive amount.` };
      return { value: Math.round(n * 100) / 100 };
    }
    case "date":
      return DATE_RE.test(s) ? { value: s } : { value: null, error: `${field.label} must be a date.` };
    case "url":
      return /^https?:\/\/\S+$/i.test(s) ? { value: s } : { value: null, error: `${field.label} must start with https://` };
    case "select":
      return field.options?.some((o) => o.value === s)
        ? { value: s }
        : { value: null, error: `Pick a valid ${field.label.toLowerCase()}.` };
    default:
      return { value: s };
  }
}

function friendly(message: string, code?: string): string {
  if (code === "23505") return "That already exists (duplicate code, name or estate/FY/channel line).";
  if (code === "23503") return "That item is still in use, or refers to something that no longer exists.";
  if (code === "23514") return "Some values aren't allowed together. Check dates and amounts.";
  if (code === "42501") return "You don't have permission to change this.";
  return message;
}

export async function saveRecord(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const kind = String(form.get("_kind") ?? "");
  const id = String(form.get("_id") ?? "") || null;
  const clientId = String(form.get("_client_id") ?? "");
  const clientSlug = String(form.get("_client_slug") ?? "");
  if (!isContentKind(kind)) return { error: "Unknown content type." };
  const def = CONTENT[kind];

  const row: Record<string, unknown> = {};
  for (const field of def.fields) {
    const { value, error } = coerce(field, form.get(field.name));
    if (error) return { error };
    row[field.name] = value;
  }

  if ("regionOrEstate" in def && def.regionOrEstate && row.region_id && row.estate_id) {
    return { error: "Pick a state or an estate, not both." };
  }
  if (kind === "flights" && String(row.end_date) < String(row.start_date)) {
    return { error: "End date is before the start date." };
  }
  if (kind === "live_placements" && row.live_to && String(row.live_to) < String(row.live_from)) {
    return { error: "Live to is before live from." };
  }

  if (kind === "internal_docs") {
    row.client_id = row.agency_wide ? null : clientId;
    delete row.agency_wide;
    if (row.body_md === null) row.body_md = "";
  } else {
    row.client_id = clientId;
  }

  const supabase = await createClient();
  const query = id
    ? supabase.from(def.table).update(row).eq("id", id).select("id")
    : supabase.from(def.table).insert(row).select("id");
  const { data, error } = await query;
  if (error) return { error: friendly(error.message, error.code) };
  if (!data?.length) return { error: "Nothing was saved. You may not have permission to change this." };

  revalidatePath(`/c/${clientSlug}`, "layout");
  return { ok: true, savedAt: Date.now() };
}

export async function deleteRecord(kind: string, id: string, clientSlug: string): Promise<SaveState> {
  await requireAdmin();
  if (!isContentKind(kind)) return { error: "Unknown content type." };
  const supabase = await createClient();
  const { data, error } = await supabase.from(CONTENT[kind].table).delete().eq("id", id).select("id");
  if (error) return { error: friendly(error.message, error.code) };
  if (!data?.length) return { error: "Nothing was deleted." };
  revalidatePath(`/c/${clientSlug}`, "layout");
  return { ok: true };
}
