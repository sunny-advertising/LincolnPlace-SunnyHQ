"use client";

import { keepValues } from "@/components/keep-form";
import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sent) {
    return (
      <div className="ok" role="status">
        If <b>{state.email}</b> has access to the portal, a sign-in link is on its way. It expires in an hour.
      </div>
    );
  }

  return (
    <form onSubmit={keepValues(action)}>
      <input type="hidden" name="next" value={next} />
      {state.error && <div className="error" role="alert">{state.error}</div>}
      <label className="field">
        Work email
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} autoFocus />
      </label>
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
