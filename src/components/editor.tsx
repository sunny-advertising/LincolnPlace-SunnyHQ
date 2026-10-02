"use client";

import { keepValues } from "@/components/keep-form";
import { createContext, useActionState, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONTENT, type ContentKind, type Field } from "@/lib/content";
import { deleteRecord, saveRecord, type SaveState } from "@/app/actions/content";
import type { Channel, Estate, Region } from "@/lib/types";

type Rec = Record<string, unknown>;
type Open = { kind: ContentKind; record: Rec | null; defaults?: Rec } | null;

type EditorCtx = {
  open: (kind: ContentKind, record: Rec | null, defaults?: Rec) => void;
  remove: (kind: ContentKind, id: string, label: string) => void;
};

const Ctx = createContext<EditorCtx | null>(null);

export type EditorOptions = {
  clientId: string;
  clientSlug: string;
  regions: Pick<Region, "id" | "code" | "name">[];
  estates: Pick<Estate, "id" | "code" | "name" | "region_id">[];
  channels: Pick<Channel, "id" | "name">[];
  currentFy: number;
};

/** Mounted once per client shell for admins. Rows call useEditor() to open the dialog. */
export function EditorProvider({ options, children }: { options: EditorOptions; children: React.ReactNode }) {
  const [current, setCurrent] = useState<Open>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const close = useCallback(() => setCurrent(null), []);

  const ctx: EditorCtx = {
    open: (kind, record, defaults) => setCurrent({ kind, record, defaults }),
    remove: (kind, id, label) => {
      if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
      startTransition(async () => {
        const res = await deleteRecord(kind, id, options.clientSlug);
        if (res.error) window.alert(res.error);
        else router.refresh();
      });
    },
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {current && (
        <RecordDialog
          key={`${current.kind}:${String(current.record?.id ?? "new")}`}
          {...current}
          options={options}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}

export function useEditor(): EditorCtx | null {
  return useContext(Ctx);
}

export function AddButton({ kind, defaults, label, primary }: { kind: ContentKind; defaults?: Rec; label?: string; primary?: boolean }) {
  const ed = useEditor();
  if (!ed) return null;
  return (
    <button type="button" className={`btn small${primary ? " primary" : ""}`} onClick={() => ed.open(kind, null, defaults)}>
      {label ?? `Add ${CONTENT[kind].label}`}
    </button>
  );
}

export function RowTools({ kind, record, label }: { kind: ContentKind; record: Rec; label?: string }) {
  const ed = useEditor();
  if (!ed) return null;
  return (
    <span className="rowtools">
      <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); ed.open(kind, record); }}>
        Edit
      </button>
      <button
        type="button"
        className="icon-btn danger"
        onClick={(e) => { e.stopPropagation(); ed.remove(kind, String(record.id), label ?? `this ${CONTENT[kind].label}`); }}
      >
        Delete
      </button>
    </span>
  );
}

function RecordDialog({ kind, record, defaults, options, onClose }: NonNullable<Open> & { options: EditorOptions; onClose: () => void }) {
  const def = CONTENT[kind];
  const [state, action, pending] = useActionState<SaveState, FormData>(saveRecord, {});
  const router = useRouter();
  const first = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, state.savedAt, router, onClose]);

  useEffect(() => {
    first.current?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initial: Rec = { ...(defaults ?? {}), ...(record ?? {}) };
  if (kind === "internal_docs" && record) initial.agency_wide = record.client_id === null;
  if ((kind === "budgets" || kind === "flights") && initial.fy === undefined) initial.fy = options.currentFy;
  const wide = def.fields.some((f) => f.type === "markdown");

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <h3 id="editor-title">{record ? `Edit ${def.label}` : `Add ${def.label}`}</h3>
        <p>Changes are visible to everyone with access as soon as you save.</p>
        <form onSubmit={keepValues(action)} ref={first}>
          <input type="hidden" name="_kind" value={kind} />
          <input type="hidden" name="_id" value={record ? String(record.id) : ""} />
          <input type="hidden" name="_client_id" value={options.clientId} />
          <input type="hidden" name="_client_slug" value={options.clientSlug} />
          {state.error && <div className="error" role="alert">{state.error}</div>}
          {def.fields.map((f) => (
            <FieldInput key={f.name} field={f} value={initial[f.name]} options={options} />
          ))}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FieldInput({ field, value, options }: { field: Field; value: unknown; options: EditorOptions }) {
  const v = value === null || value === undefined ? "" : String(value);
  const common = { name: field.name, required: field.required, defaultValue: v, placeholder: field.placeholder };

  if (field.type === "checkbox") {
    return (
      <label className="field check">
        <input type="checkbox" name={field.name} defaultChecked={value === true} /> {field.label}
      </label>
    );
  }

  let input: React.ReactNode;
  switch (field.type) {
    case "textarea":
      input = <textarea {...common} />;
      break;
    case "markdown":
      input = <textarea {...common} className="code" />;
      break;
    case "number":
    case "fy":
      input = <input {...common} type="number" step={1} />;
      break;
    case "money":
      input = <input {...common} type="number" step="0.01" min={0} inputMode="decimal" />;
      break;
    case "date":
      input = <input {...common} type="date" />;
      break;
    case "url":
      input = <input {...common} type="url" />;
      break;
    case "select":
      input = (
        <select {...common}>
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case "region":
      input = (
        <select {...common}>
          <option value="">{field.required ? "Choose a state…" : "All states"}</option>
          {options.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      );
      break;
    case "estate":
      input = (
        <select {...common}>
          <option value="">{field.required ? "Choose an estate…" : "No specific estate"}</option>
          {options.regions.map((r) => (
            <optgroup key={r.id} label={r.name}>
              {options.estates.filter((e) => e.region_id === r.id).map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
              ))}
            </optgroup>
          ))}
        </select>
      );
      break;
    case "channel":
      input = (
        <select {...common}>
          <option value="">Choose a channel…</option>
          {options.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      );
      break;
    default:
      input = <input {...common} type="text" />;
  }

  return (
    <label className="field">
      {field.label}
      {input}
      {field.help && <span className="help">{field.help}</span>}
    </label>
  );
}
