import type { Metadata } from "next";
import { completeSignIn } from "./actions";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

// Sign-in links are single use. Email security scanners (e.g. Outlook Safe Links)
// open links automatically, so the token is only spent when a person presses the button.
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const hasToken = str("token_hash") || str("code");

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="wm">Sunny<span>.</span> Client portal</div>
        {hasToken ? (
          <>
            <p>Press the button to finish signing in.</p>
            <form action={completeSignIn}>
              <input type="hidden" name="token_hash" value={str("token_hash")} />
              <input type="hidden" name="code" value={str("code")} />
              <input type="hidden" name="type" value={str("type") || "magiclink"} />
              <input type="hidden" name="next" value={safeNext(str("next"))} />
              <button className="btn primary" type="submit">Sign in to the portal</button>
            </form>
          </>
        ) : (
          <>
            <p>This sign-in link is incomplete. Request a new one.</p>
            <a className="btn primary" href="/login">Go to sign in</a>
          </>
        )}
      </div>
    </div>
  );
}
