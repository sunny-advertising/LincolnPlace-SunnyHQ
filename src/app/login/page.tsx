import type { Metadata } from "next";
import { LoginForm } from "./form";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : "/");
  const failed = sp.error === "link";
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="wm">Sunny<span>.</span> Client portal</div>
        <p>Sign in with the email your Sunny team invited. We&apos;ll send you a one-time link.</p>
        {failed && (
          <div className="error" role="alert">That sign-in link has expired or was already used. Request a new one below.</div>
        )}
        <LoginForm next={next} />
      </div>
    </div>
  );
}
