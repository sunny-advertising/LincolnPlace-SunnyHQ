// One definition per editable content type. Drives both the admin edit dialog
// (client) and the save action's validation (server), so a field added here
// shows up in the form and is accepted by the action with no other changes.

export type FieldType =
  | "text" | "textarea" | "markdown" | "number" | "money" | "date" | "url"
  | "select" | "checkbox" | "estate" | "channel" | "region" | "fy";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
  placeholder?: string;
};

export type ContentType = {
  table: string;
  label: string;
  fields: Field[];
  /** Rows carry client_id (true for everything except agency-wide docs). */
  clientScoped: boolean;
  /** Region and estate are alternative narrowings; at most one may be set. */
  regionOrEstate?: boolean;
};

const estate = (required = true): Field => ({
  name: "estate_id", label: required ? "Estate" : "Estate (optional)", type: "estate", required,
});
const region = (required = false): Field => ({
  name: "region_id", label: required ? "State" : "State (optional)", type: "region", required,
});
const channel: Field = { name: "channel_id", label: "Channel", type: "channel", required: true };
const notes: Field = { name: "notes", label: "Notes", type: "textarea" };
const sort: Field = { name: "sort_order", label: "Sort order", type: "number", help: "Lower numbers show first." };

export const CONTENT = {
  budgets: {
    table: "budgets", label: "budget line", clientScoped: true,
    fields: [
      estate(), { name: "fy", label: "Financial year", type: "fy", required: true }, channel,
      { name: "approved", label: "Approved ($)", type: "money", required: true },
      { name: "booked", label: "Booked ($)", type: "money", required: true },
      { name: "approved_at", label: "Approved on", type: "date" },
      { name: "approved_by", label: "Approved by", type: "text" },
      notes,
    ],
  },
  flights: {
    table: "flights", label: "flight", clientScoped: true,
    fields: [
      estate(), { name: "fy", label: "Financial year", type: "fy", required: true }, channel,
      { name: "vendor", label: "Vendor", type: "text" },
      { name: "start_date", label: "Start", type: "date", required: true },
      { name: "end_date", label: "End", type: "date", required: true },
      { name: "status", label: "Status", type: "select", required: true, options: [
        { value: "booked", label: "Booked" }, { value: "proposed", label: "Proposed" }] },
      notes,
    ],
  },
  live_placements: {
    table: "live_placements", label: "live placement", clientScoped: true,
    fields: [
      estate(), channel,
      { name: "creative", label: "Creative", type: "text", required: true },
      { name: "vendor", label: "Vendor", type: "text" },
      { name: "live_from", label: "Live from", type: "date", required: true },
      { name: "live_to", label: "Live to", type: "date", help: "Leave blank if ongoing." },
      { name: "preview_url", label: "Preview link", type: "url" },
      { name: "paused", label: "Paused", type: "checkbox" },
      notes,
    ],
  },
  material_due: {
    table: "material_due", label: "material item", clientScoped: true,
    fields: [
      estate(), channel,
      { name: "placement", label: "Placement", type: "text", required: true },
      { name: "vendor", label: "Vendor", type: "text" },
      { name: "specs", label: "Specs", type: "textarea" },
      { name: "due_date", label: "Due", type: "date", required: true },
      { name: "supplied_by", label: "Supplied by", type: "select", required: true, options: [
        { value: "client", label: "Client" }, { value: "sunny", label: "Sunny" }] },
      { name: "status", label: "Status", type: "select", required: true, options: [
        { value: "due", label: "Not yet supplied" }, { value: "supplied", label: "Supplied" }],
        help: "Overdue is worked out from the due date." },
      { name: "supplied_at", label: "Supplied on", type: "date" },
      notes,
    ],
  },
  reports: {
    table: "reports", label: "report link", clientScoped: true, regionOrEstate: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "kind", label: "Type", type: "select", required: true, options: [
        { value: "whatagraph", label: "Whatagraph dashboard" }, { value: "pcr", label: "Post-campaign report" },
        { value: "other", label: "Other" }] },
      { name: "url", label: "Link", type: "url", required: true, help: "Anyone with a Whatagraph share link can open it." },
      { name: "period", label: "Period", type: "text", placeholder: "Jul – Sep 2026" },
      region(), estate(false),
      sort,
    ],
  },
  key_dates: {
    table: "key_dates", label: "key date", clientScoped: true, regionOrEstate: true,
    fields: [
      { name: "date", label: "Date", type: "date", required: true },
      { name: "title", label: "What", type: "text", required: true },
      region(), estate(false), notes,
    ],
  },
  contacts: {
    table: "contacts", label: "contact", clientScoped: true,
    fields: [
      { name: "org", label: "Team", type: "select", required: true, options: [
        { value: "sunny", label: "Sunny" }, { value: "client", label: "Client" }, { value: "vendor", label: "Vendor" }] },
      { name: "role_title", label: "Role", type: "text", required: true, placeholder: "Account lead" },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "email", label: "Email", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      sort,
    ],
  },
  sheet_links: {
    table: "sheet_links", label: "sheet", clientScoped: true, regionOrEstate: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "url", label: "Link", type: "url", required: true, placeholder: "https://docs.google.com/spreadsheets/…" },
      { name: "description", label: "Description", type: "textarea" },
      region(), estate(false),
      { name: "staff_only", label: "Sunny staff only", type: "checkbox" },
      sort,
    ],
  },
  internal_docs: {
    table: "internal_docs", label: "document", clientScoped: true,
    fields: [
      { name: "section", label: "Section", type: "select", required: true, options: [
        { value: "sops", label: "Processes & SOPs" }, { value: "specs", label: "Specs & deadlines" },
        { value: "notes", label: "Internal notes" }] },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "summary", label: "Summary", type: "text", help: "One line shown on the card." },
      { name: "url", label: "External link", type: "url", help: "Optional. The card opens this instead of the page below." },
      region(),
      { name: "body_md", label: "Content (Markdown)", type: "markdown" },
      { name: "agency_wide", label: "Agency-wide (show for every client)", type: "checkbox" },
      sort,
    ],
  },
  estates: {
    table: "estates", label: "estate", clientScoped: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, placeholder: "LLY" },
      { name: "name", label: "Name", type: "text", required: true },
      region(true),
      { name: "subtitle", label: "Subtitle", type: "text", placeholder: "Townsville" },
      sort,
    ],
  },
  regions: {
    table: "regions", label: "state", clientScoped: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, placeholder: "QLD" },
      { name: "name", label: "Name", type: "text", required: true },
      sort,
    ],
  },
  channels: {
    table: "channels", label: "channel", clientScoped: true,
    fields: [{ name: "name", label: "Name", type: "text", required: true }, sort],
  },
} satisfies Record<string, ContentType>;

export type ContentKind = keyof typeof CONTENT;

export function isContentKind(k: string): k is ContentKind {
  return Object.prototype.hasOwnProperty.call(CONTENT, k);
}
