"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

const TYPES: EmailOtpType[] = ["magiclink", "email", "invite", "signup", "recovery"];

export async function completeSignIn(form: FormData) {
  const tokenHash = String(form.get("token_hash") ?? "");
  const code = String(form.get("code") ?? "");
  const type = String(form.get("type") ?? "magiclink") as EmailOtpType;
  const next = safeNext(String(form.get("next") ?? "/"));
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  redirect(ok ? next : "/login?error=link");
}
