import { NextResponse, type NextRequest } from "next/server";
import { fyLabel, fyOf } from "@/lib/format";
import { loadEstateContent } from "@/lib/queries";
import { loadClientContext, requireViewer } from "@/lib/session";

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// CSV of the state's (or one estate's) flights with the matching budget lines. Read through RLS.
export async function GET(request: NextRequest, ctx: RouteContext<"/c/[client]/[region]/media-plan">) {
  const { client: slug, region: code } = await ctx.params;
  await requireViewer();
  const c = await loadClientContext(slug);
  const region = c.regions.find((r) => r.code.toLowerCase() === code.toLowerCase());
  if (!region) return new NextResponse("Not found", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const fy = Number(sp.get("fy")) || fyOf(c.today);
  const estates = c.estates.filter((e) => e.region_id === region.id && (!sp.get("estate") || e.code === sp.get("estate")));
  const { flights, budgets } = await loadEstateContent(c.client.id, estates.map((e) => e.id), fy);
  const ch = new Map(c.channels.map((x) => [x.id, x.name]));

  const lines = [["Estate code", "Estate", "Channel", "Vendor", "Start", "End", "Status", "Approved budget", "Booked budget"]];
  for (const e of estates) {
    const eb = budgets.filter((b) => b.estate_id === e.id);
    const ef = flights.filter((f) => f.estate_id === e.id);
    const channels = new Set([...eb.map((b) => b.channel_id), ...ef.map((f) => f.channel_id)]);
    for (const cid of channels) {
      const b = eb.find((x) => x.channel_id === cid);
      const fl = ef.filter((f) => f.channel_id === cid);
      if (!fl.length) lines.push([e.code, e.name, ch.get(cid) ?? "", "", "", "", "", String(b?.approved ?? ""), String(b?.booked ?? "")]);
      fl.forEach((f, i) => lines.push([
        e.code, e.name, ch.get(cid) ?? "", f.vendor ?? "", f.start_date, f.end_date, f.status,
        i === 0 ? String(b?.approved ?? "") : "", i === 0 ? String(b?.booked ?? "") : "",
      ]));
    }
  }

  const name = `${c.client.slug}-${region.code}${sp.get("estate") ? "-" + sp.get("estate") : ""}-${fyLabel(fy)}-media-plan.csv`;
  return new NextResponse(lines.map((l) => l.map(csv).join(",")).join("\n") + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` },
  });
}
