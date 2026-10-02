// Creates the first admin's auth user and prints a sign-in link.
// The seed adds an admin invite for lily@sunnyadvertising.com.au; the database
// trigger turns it into an admin profile when the user is created here.
//
//   node --env-file=.env.local scripts/bootstrap-admin.mjs [email]
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SITE_URL.
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "lily@sunnyadvertising.com.au").toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: invites } = await admin.from("invites").select("id,role").ilike("email", email).is("accepted_at", null);
if (!invites?.length) {
  console.error(`No open invite for ${email}. Add one first, e.g.:\n` +
    `  insert into public.invites (email, role) values ('${email}', 'admin');`);
  process.exit(1);
}

const created = await admin.auth.admin.createUser({ email, email_confirm: true });
if (created.error && !/already|registered|exists/i.test(created.error.message)) {
  console.error(created.error.message);
  process.exit(1);
}

const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error(error.message);
  process.exit(1);
}
await admin.rpc("apply_invite", { p_invite_id: invites[0].id, p_user_id: data.user.id });

console.log(`\n${email} is set up as ${invites[0].role}. Sign in with this one-time link:\n`);
console.log(`${site}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=/\n`);
