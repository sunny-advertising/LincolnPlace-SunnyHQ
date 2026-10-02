import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Sends each user to their client. Sunny staff with several clients pick one.
export default async function Home() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("name,slug").order("name");
  if (!clients?.length) redirect("/no-access");
  if (clients.length === 1 || !viewer.isStaff) redirect(`/c/${clients[0].slug}`);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="wm">Sunny<span>.</span> Client portal</div>
        <p>Choose a client.</p>
        <div className="navgroup">
          {clients.map((c) => (
            <Link key={c.slug} className="nav" href={`/c/${c.slug}`}>{c.name}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
