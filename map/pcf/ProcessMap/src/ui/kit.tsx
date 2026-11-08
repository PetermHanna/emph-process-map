// Small building blocks shared by the pages.
import * as React from "react";
import { Dropdown, Option, Input, Textarea, Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { Add16Regular, Edit12Regular } from "@fluentui/react-icons";
import { C, useLook } from "./look";
import type { Model } from "../domain/types";
import type { Repository } from "../domain/repository";

export type Apply = (fn: (m: Model) => Promise<Model>) => Promise<void>;
export interface PageProps { model: Model; repo: Repository; apply: Apply }

/** A coloured pill: state, coverage, origin. */
export function Pill({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "brand" }) {
  const col = { neutral: [C.muted, "#F1F5F9"], ok: [C.ok, "#DCFCE7"], warn: [C.warn, "#FEF3C7"], bad: [C.bad, "#FEE2E2"], info: [C.info, "#DBEAFE"], brand: ["#0F766E", "#CCF3EF"] }[tone];
  return <span style={{ color: col[0], backgroundColor: col[1], borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{text}</span>;
}

/** Choice from an option set; empty means none. */
export function Choice({ value, labels, onChange, placeholder = "Not set", disabled, width }: { value: number | null; labels: Record<number, string>; onChange: (v: number | null) => void; placeholder?: string; disabled?: boolean; width?: number }) {
  return (
    <Dropdown disabled={disabled} style={{ minWidth: width || 150 }} value={value != null ? labels[value] || "" : ""} placeholder={placeholder} selectedOptions={value != null ? [String(value)] : []}
      onOptionSelect={(_, d) => onChange(d.optionValue ? Number(d.optionValue) : null)}>
      <Option value="">{placeholder}</Option>
      {Object.keys(labels).map(k => <Option key={k} value={k}>{labels[Number(k)]}</Option>)}
    </Dropdown>
  );
}

/** Choice from records by id. */
export function Pick<T extends { id: string; name: string }>({ value, items, onChange, placeholder = "None", disabled, width }: { value: string | null; items: T[]; onChange: (id: string | null) => void; placeholder?: string; disabled?: boolean; width?: number }) {
  const cur = items.find(x => x.id === value);
  return (
    <Dropdown disabled={disabled} style={{ minWidth: width || 180 }} value={cur?.name || ""} placeholder={placeholder} selectedOptions={value ? [value] : []} onOptionSelect={(_, d) => onChange(d.optionValue || null)}>
      <Option value="">{placeholder}</Option>
      {items.map(x => <Option key={x.id} value={x.id}>{x.name}</Option>)}
    </Dropdown>
  );
}

/** Text that saves when you leave the field. */
export function Edit({ value, onSave, multiline, placeholder, disabled }: { value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string; disabled?: boolean }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  const done = () => { if (v !== value) onSave(v); };
  return multiline
    ? <Textarea disabled={disabled} resize="vertical" value={v} placeholder={placeholder} onChange={(_, d) => setV(d.value)} onBlur={done} />
    : <Input disabled={disabled} value={v} placeholder={placeholder} onChange={(_, d) => setV(d.value)} onBlur={done} onKeyDown={e => { if (e.key === "Enter") done(); }} />;
}

/** One-line add box. */
export function AddBox({ placeholder, onAdd, label = "Add" }: { placeholder: string; onAdd: (text: string) => void; label?: string }) {
  const [v, setV] = React.useState("");
  const go = () => { if (v.trim()) { onAdd(v.trim()); setV(""); } };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <Input style={{ flexGrow: 1 }} value={v} placeholder={placeholder} onChange={(_, d) => setV(d.value)} onKeyDown={e => { if (e.key === "Enter") go(); }} />
      <Button icon={<Add16Regular />} disabled={!v.trim()} onClick={go}>{label}</Button>
    </div>
  );
}

export function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: string }) {
  const l = useLook();
  return <div className={l.card}><div className={l.stat} style={{ color: tone }}>{value}</div><div className={l.statLabel}>{label}</div></div>;
}

export function Meter({ part, whole, colour = C.railActive }: { part: number; whole: number; colour?: string }) {
  const l = useLook();
  return <div className={l.bar} title={part + " of " + whole}><div style={{ width: (whole ? (100 * part) / whole : 0) + "%", height: "100%", backgroundColor: colour }} /></div>;
}

export function Problem({ text, onClose }: { text: string | null; onClose?: () => void }) {
  if (!text) return null;
  return <MessageBar intent="error"><MessageBarBody>{text}</MessageBarBody>{onClose && <Button size="small" appearance="transparent" onClick={onClose}>Close</Button>}</MessageBar>;
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  const l = useLook();
  return <div className={l.card} style={{ textAlign: "center", padding: 36 }}><div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div><div className={l.muted} style={{ margin: "6px 0 14px" }}>{text}</div>{action}</div>;
}

/**
 * A name you can rename in place. When it differs from Microsoft's catalog name, that name shows underneath with a way back to it.
 */
export function Rename({ name, catalogName, onSave, size = 13, weight = 600 }: { name: string; catalogName?: string; onSave: (v: string) => void; size?: number; weight?: number }) {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState(name);
  React.useEffect(() => setV(name), [name]);
  const done = () => { setEditing(false); const t = v.trim(); if (t && t !== name) onSave(t); else setV(name); };
  const renamed = !!catalogName && catalogName !== name;
  if (editing) return (
    <Input size="small" autoFocus value={v} style={{ width: "100%" }} onClick={e => e.stopPropagation()} onChange={(_, d) => setV(d.value)} onBlur={done}
      onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") done(); if (e.key === "Escape") { setV(name); setEditing(false); } }} />
  );
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", minWidth: 0 }}>
      <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 4 }}>
        <span style={{ fontSize: size, fontWeight: weight, lineHeight: 1.3 }}>{name}</span>
        <button data-emph="rename" title="Rename" aria-label={"Rename " + name} onClick={e => { e.stopPropagation(); setEditing(true); }}
          style={{ border: 0, background: "transparent", cursor: "pointer", padding: 0, color: "#94A3B8", lineHeight: 0, flexShrink: 0 }}><Edit12Regular /></button>
      </span>
      {renamed && <span style={{ fontSize: 10, color: C.muted, lineHeight: 1.3 }}>Microsoft: {catalogName}{" "}
        <button onClick={e => { e.stopPropagation(); onSave(catalogName!); }} style={{ border: 0, background: "transparent", color: "#0F766E", cursor: "pointer", padding: 0, fontSize: 10, textDecoration: "underline" }}>use</button></span>}
    </span>
  );
}
