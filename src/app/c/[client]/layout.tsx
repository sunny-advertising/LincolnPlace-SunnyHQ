import { Sidebar } from "@/components/sidebar";
import { EditorProvider } from "@/components/editor";
import { fyOf } from "@/lib/format";
import { loadClientContext, requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function ClientLayout({ children, params }: LayoutProps<"/c/[client]">) {
  const { client: slug } = await params;
  const viewer = await requireViewer();
  const ctx = await loadClientContext(slug);

  const supabase = await createClient();
  const { data: overdue } = await supabase
    .from("material_due_v")
    .select("estate_id")
    .eq("client_id", ctx.client.id)
    .eq("state", "overdue");
  const overdueEstates = new Set((overdue ?? []).map((r) => r.estate_id as string));

  const states = ctx.regions.map((r) => {
    const es = ctx.estates.filter((e) => e.region_id === r.id);
    return { code: r.code, name: r.name, estates: es.length, overdue: es.some((e) => overdueEstates.has(e.id)) };
  });

  const shell = (
    <div className="app">
      <Sidebar
        clientSlug={ctx.client.slug}
        clientName={ctx.client.name}
        clients={ctx.clients.map((c) => ({ slug: c.slug, name: c.name }))}
        states={states}
        role={viewer.profile.role}
        userLabel={viewer.profile.name || viewer.email}
      />
      <div className="main">{children}</div>
    </div>
  );

  if (!viewer.isAdmin) return shell;
  return (
    <EditorProvider
      options={{
        clientId: ctx.client.id,
        clientSlug: ctx.client.slug,
        regions: ctx.regions.map(({ id, code, name }) => ({ id, code, name })),
        estates: ctx.estates.map(({ id, code, name, region_id }) => ({ id, code, name, region_id })),
        channels: ctx.channels.map(({ id, name }) => ({ id, name })),
        currentFy: fyOf(ctx.today),
      }}
    >
      {shell}
    </EditorProvider>
  );
}
