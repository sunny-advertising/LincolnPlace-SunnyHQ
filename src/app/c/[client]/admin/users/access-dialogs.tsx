"use client";

import { keepValues } from "@/components/keep-form";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUser, resendLink, setDisabled, updateAccess, type AccessState } from "./actions";
import type { Role } from "@/lib/types";

export type ScopeOptions = {
  clientId: string;
  clientSlug: string;
  clientName: string;
  regions: { id: string; code: string; name: string }[];
  estates: { id: string; code: string; name: string; region_id: string }[];
};

export type UserRowData = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  disabled: boolean;
  isSelf: boolean;
  regionIds: string[];
  estateIds: string[];
  wholeClient: boolean;
};

function Modal({ title, intro, onClose, children }: { title: string; intro: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <p>{intro}</p>
        {children}
      </div>
    </div>
  );
}

function LinkBox({ link, email }: { link: string; email?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="linkbox">
      <b style={{ color: "var(--ink)" }}>Sign-in link{email ? ` for ${email}` : ""}</b>
      <br />
      {link}
      <br />
      <span className="muted">
        Single use. Expires per your Supabase sign-in link setting (1 hour by default). Use Resend link if it lapses.
      </span>
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn small"
          onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

/** Role + scope fields shared by invite and edit. */
function AccessFields({ opts, initial }: { opts: ScopeOptions; initial?: UserRowData }) {
  const [role, setRole] = useState<Role>(initial?.role ?? "client");
  const startMode = !initial || initial.wholeClient ? "all" : initial.regionIds.length ? "regions" : initial.estateIds.length ? "estates" : "all";
  const [mode, setMode] = useState<"all" | "regions" | "estates">(startMode);

  return (
    <>
      <input type="hidden" name="client_id" value={opts.clientId} />
      <input type="hidden" name="client_slug" value={opts.clientSlug} />
      <label className="field">
        Role
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="client">Client ({opts.clientName})</option>
          <option value="staff">Sunny staff (sees everything, can&apos;t edit)</option>
          <option value="admin">Admin (edits content, manages users)</option>
        </select>
      </label>
      {role === "client" && (
        <>
          <label className="field">
            What they can see
            <select name="scope_mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="all">All {opts.clientName} estates</option>
              <option value="regions">Specific states</option>
              <option value="estates">Specific estates</option>
            </select>
          </label>
          {mode === "regions" && (
            <div className="field">
              States
              <div className="checks">
                {opts.regions.map((r) => (
                  <label key={r.id}>
                    <input type="checkbox" name="region_ids" value={r.id} defaultChecked={initial?.regionIds.includes(r.id)} /> {r.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {mode === "estates" && (
            <div className="field">
              Estates
              {opts.regions.map((r) => (
                <div key={r.id}>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{r.name}</div>
                  <div className="checks">
                    {opts.estates.filter((e) => e.region_id === r.id).map((e) => (
                      <label key={e.id}>
                        <input type="checkbox" name="estate_ids" value={e.id} defaultChecked={initial?.estateIds.includes(e.id)} /> {e.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export function InviteButton({ opts }: { opts: ScopeOptions }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const router = useRouter();
  const close = () => { setOpen(false); router.refresh(); };

  return (
    <>
      <button className="btn primary" type="button" onClick={() => { setKey((k) => k + 1); setOpen(true); }}>Invite user</button>
      {open && (
        <Modal title="Invite a user" intro="They'll get a sign-in link. Access is set by role and estates." onClose={close}>
          <InviteForm key={key} opts={opts} onClose={close} onAnother={() => setKey((k) => k + 1)} />
        </Modal>
      )}
    </>
  );
}

function InviteForm({ opts, onClose, onAnother }: { opts: ScopeOptions; onClose: () => void; onAnother: () => void }) {
  const [state, action, pending] = useActionState<AccessState, FormData>(inviteUser, {});

  if (state.link) {
    return (
      <>
        <LinkBox link={state.link} email={state.email} />
        <div className="row">
          <button type="button" className="btn" onClick={onAnother}>Invite another</button>
          <button type="button" className="btn primary" onClick={onClose}>Done</button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={keepValues(action)}>
      {state.error && <div className="error" role="alert">{state.error}</div>}
      <label className="field">Email<input name="email" type="email" required placeholder="name@lincolnplace.com.au" autoFocus /></label>
      <label className="field">Name<input name="name" placeholder="Optional" /></label>
      <AccessFields opts={opts} />
      <div className="row">
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <button type="submit" className="btn primary" disabled={pending}>{pending ? "Generating…" : "Generate link"}</button>
      </div>
    </form>
  );
}

export function UserActions({ user, opts }: { user: UserRowData; opts: ScopeOptions }) {
  const [editing, setEditing] = useState(false);
  const [linkState, setLinkState] = useState<AccessState | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  const [state, action, pending] = useActionState<AccessState, FormData>(async (prev, form) => {
    const res = await updateAccess(prev, form);
    if (res.done) { setEditing(false); router.refresh(); }
    return res;
  }, {});

  const resend = () => start(async () => setLinkState(await resendLink(user.id)));
  const toggle = () => start(async () => {
    if (!user.disabled && !window.confirm(`Disable ${user.email}? They lose access immediately.`)) return;
    const res = await setDisabled(user.id, !user.disabled, opts.clientSlug);
    if (res.error) window.alert(res.error);
    router.refresh();
  });

  return (
    <span className="rowtools">
      {!user.disabled && <button className="btn small" type="button" onClick={resend} disabled={busy}>Resend link</button>}
      <button className="btn small" type="button" onClick={() => setEditing(true)}>Edit access</button>
      {!user.isSelf && (
        <button className={`btn small${user.disabled ? "" : " danger"}`} type="button" onClick={toggle} disabled={busy}>
          {user.disabled ? "Enable" : "Disable"}
        </button>
      )}

      {linkState && (
        <Modal title="New sign-in link" intro="Copy this and send it to them. Any earlier link stops working." onClose={() => setLinkState(null)}>
          {linkState.error ? <div className="error">{linkState.error}</div> : <LinkBox link={linkState.link!} email={linkState.email} />}
          <div className="row"><button className="btn" type="button" onClick={() => setLinkState(null)}>Close</button></div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit access · ${user.name || user.email}`} intro="Changes apply from their next page load." onClose={() => setEditing(false)}>
          <form onSubmit={keepValues(action)}>
            <input type="hidden" name="user_id" value={user.id} />
            {state.error && <div className="error" role="alert">{state.error}</div>}
            <AccessFields opts={opts} initial={user} />
            <div className="row">
              <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </span>
  );
}
