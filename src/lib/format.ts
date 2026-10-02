// Formatting and date helpers. Dates from Postgres arrive as "YYYY-MM-DD" and are
// treated as calendar dates (UTC midnight) so timezones never shift them.

export const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

export function moneyShort(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "m";
  if (n >= 1000) return "$" + (n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n);
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Today as YYYY-MM-DD in the given IANA timezone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function parseDate(d: string): Date {
  return new Date(d.slice(0, 10) + "T00:00:00Z");
}

/** "10 Oct" (adds the year when it differs from `refYear`). */
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(d: string, refYear?: number): string {
  const dt = parseDate(d);
  const s = `${dt.getUTCDate()} ${MONTH_SHORT[dt.getUTCMonth()]}`;
  return refYear !== undefined && dt.getUTCFullYear() !== refYear ? `${s} ${dt.getUTCFullYear()}` : s;
}

export function dateRange(from: string, to: string | null, refYear?: number): string {
  return to ? `${shortDate(from, refYear)} – ${shortDate(to, refYear)}` : `From ${shortDate(from, refYear)}`;
}

/** Australian financial year, named by the year it ends: Jul 2026 – Jun 2027 is FY27 (2027). */
export function fyOf(date: string): number {
  const dt = parseDate(date);
  return dt.getUTCMonth() >= 6 ? dt.getUTCFullYear() + 1 : dt.getUTCFullYear();
}

export function fyLabel(fy: number): string {
  return "FY" + String(fy % 100).padStart(2, "0");
}

export function fyBounds(fy: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(fy - 1, 6, 1)), end: new Date(Date.UTC(fy, 6, 1)) };
}

/** Position of a date within the FY as a 0–1 fraction (clamped). */
export function fyFraction(fy: number, date: string): number {
  const { start, end } = fyBounds(fy);
  const t = (parseDate(date).getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.min(1, Math.max(0, t));
}

export function addDays(date: string, days: number): string {
  const dt = parseDate(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** "just now", "5m ago", "3h ago", "yesterday", "4d ago", "2 weeks ago", "12 Aug". */
export function timeAgo(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "never";
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 35) return `${Math.floor(d / 7)} week${d < 14 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function latest(...isos: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const i of isos) if (i && (!best || i > best)) best = i;
  return best;
}
