"use server";

import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";

export type LoginState = { sent?: boolean; error?: string; email?: string };

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(form.get("next") ?? "/"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // No public sign-up: unknown emails never get an account.
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  // Same response whether or not the email has access, so the form can't be used
  // to discover who has an account. Rate limits are the one error worth showing.
  if (error && error.status === 429) {
    return { error: "Too many sign-in requests. Wait a minute and try again.", email };
  }
  return { sent: true, email };
}
