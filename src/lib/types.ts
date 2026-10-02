// Row shapes for the tables the app reads. Kept by hand to match supabase/migrations.
export type Role = "admin" | "staff" | "client";

export type Client = { id: string; name: string; slug: string; timezone: string };
export type Region = { id: string; client_id: string; code: string; name: string; sort_order: number };
export type Estate = {
  id: string; client_id: string; region_id: string; code: string; name: string;
  subtitle: string | null; sort_order: number; updated_at: string;
};
export type Channel = { id: string; client_id: string; name: string; sort_order: number };

export type Profile = {
  id: string; client_id: string | null; name: string | null; email: string; role: Role;
  disabled_at: string | null; last_sign_in_at: string | null; created_at: string;
};
export type UserScope = { id: string; user_id: string; client_id: string; region_id: string | null; estate_id: string | null };
export type Invite = {
  id: string; email: string; name: string | null; role: Role; client_id: string | null;
  scope: ScopeEntry[]; user_id: string | null; created_at: string; expires_at: string | null; accepted_at: string | null;
};
export type ScopeEntry = { region_id?: string | null; estate_id?: string | null };

type Stamped = { updated_at: string; updated_by: string | null };

export type Budget = Stamped & {
  id: string; client_id: string; estate_id: string; fy: number; channel_id: string;
  approved: number; booked: number; approved_at: string | null; approved_by: string | null; notes: string | null;
};
export type Flight = Stamped & {
  id: string; client_id: string; estate_id: string; fy: number; channel_id: string; vendor: string | null;
  start_date: string; end_date: string; status: "booked" | "proposed"; notes: string | null;
};
export type LivePlacement = Stamped & {
  id: string; client_id: string; estate_id: string; channel_id: string; vendor: string | null; creative: string;
  live_from: string; live_to: string | null; preview_url: string | null; paused: boolean; notes: string | null;
  state: "live" | "scheduled" | "ended" | "paused";
};
export type MaterialDue = Stamped & {
  id: string; client_id: string; estate_id: string; channel_id: string; vendor: string | null; placement: string;
  specs: string | null; due_date: string; supplied_by: "client" | "sunny"; status: "due" | "supplied";
  supplied_at: string | null; notes: string | null; state: "overdue" | "due_soon" | "due" | "supplied";
};
export type Report = Stamped & {
  id: string; client_id: string; region_id: string | null; estate_id: string | null; title: string;
  period: string | null; kind: "whatagraph" | "pcr" | "other"; url: string; sort_order: number;
};
export type KeyDate = Stamped & {
  id: string; client_id: string; region_id: string | null; estate_id: string | null; date: string; title: string; notes: string | null;
};
export type Contact = Stamped & {
  id: string; client_id: string; org: "sunny" | "client" | "vendor"; role_title: string; name: string;
  email: string | null; phone: string | null; sort_order: number;
};
export type SheetLink = Stamped & {
  id: string; client_id: string; region_id: string | null; estate_id: string | null; title: string;
  description: string | null; url: string; staff_only: boolean; sort_order: number;
};
export type InternalDoc = Stamped & {
  id: string; client_id: string | null; section: "sops" | "specs" | "notes"; region_id: string | null;
  title: string; summary: string | null; body_md: string; url: string | null; sort_order: number;
};
