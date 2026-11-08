// Sign-off export in the browser with no extra library: an Excel workbook, a Word document and a print view for PDF.
import { ITEM, MOSCOW_LABEL, CATEGORY_LABEL, REQ_STATE_LABEL, COVERAGE_LABEL, SIZE_LABEL, REQ_ORIGIN_LABEL, DELTA } from "./codes";
import type { FrozenItem } from "./rules";

export interface Table { title: string; columns: string[]; rows: string[][] }

const DELTA_LABEL: Record<number, string> = { [DELTA.same]: "Unchanged", [DELTA.added]: "Added", [DELTA.changed]: "Changed", [DELTA.removed]: "Removed" };
const label = (m: Record<number, string>, v: unknown) => (v != null ? m[v as number] || "" : "");

/** A sign-off's contents as one table per kind of item. */
export function signOffTables(items: FrozenItem[]): Table[] {
  const of = (t: number) => items.filter(x => x.type === t);
  return [
    { title: "Requirements", columns: ["ID", "Description", "Raised by", "Origin", "MoSCoW", "Category", "State", "Coverage", "Size", "Owner", "Resolution", "Resolved by", "Resolved on"],
      rows: of(ITEM.requirement).map(({ description, snapshot: x }) => [x.reqId || "", description, x.raisedBy || "", label(REQ_ORIGIN_LABEL, x.origin), label(MOSCOW_LABEL, x.moscow), label(CATEGORY_LABEL, x.category), label(REQ_STATE_LABEL, x.state), label(COVERAGE_LABEL, x.coverage), label(SIZE_LABEL, x.size), x.owner || "", x.resolution || "", x.resolvedBy || "", x.resolvedOn || ""]) },
    { title: "Configuration decisions", columns: ["Code", "Question", "Answer", "Business process"], rows: of(ITEM.decision).map(x => [x.name, x.description, x.snapshot.answer || "", x.snapshot.process || ""]) },
    { title: "Process flows", columns: ["Flow", "Activity", "Name", "Lane", "Change", "Rationale"],
      rows: of(ITEM.flow).flatMap(f => (f.snapshot.activities || []).map((a: any) => [f.name, a.code, a.name, a.lane || "", label(DELTA_LABEL, a.delta), a.rationale || ""])) },
    { title: "Scope", columns: ["Catalog ID", "Business process", "Process area", "In scope"], rows: of(ITEM.scope).map(x => [x.snapshot.code || "", x.name, x.snapshot.area || "", x.snapshot.inScope ? "Yes" : "No"]) },
  ];
}

const esc = (v: string) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const xml = (v: string) => esc(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
const colName = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };

function crc32(b: Uint8Array): number {
  let r = 0xffffffff;
  for (let i = 0; i < b.length; i++) { let c = (r ^ b[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; }
  return (r ^ 0xffffffff) >>> 0;
}

/** A stored (uncompressed) zip: all a workbook needs. */
function storeZip(files: { name: string; text: string }[]): Uint8Array {
  const enc = new TextEncoder(), body: Uint8Array[] = [], dir: Uint8Array[] = [];
  const w16 = (v: number) => [v & 255, v >>> 8], w32 = (v: number) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24];
  let at = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.text);
    const head = [...w16(20), ...w16(0x0800), ...w16(0), ...w16(0), ...w16(33), ...w32(crc32(data)), ...w32(data.length), ...w32(data.length), ...w16(name.length), ...w16(0)];
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...head, ...name]);
    body.push(local, data);
    dir.push(new Uint8Array([0x50, 0x4b, 1, 2, ...w16(20), ...head, ...w16(0), ...w16(0), ...w16(0), ...w32(0), ...w32(at), ...name]));
    at += local.length + data.length;
  }
  const dirSize = dir.reduce((a, c) => a + c.length, 0);
  const tail = new Uint8Array([0x50, 0x4b, 5, 6, ...w16(0), ...w16(0), ...w16(files.length), ...w16(files.length), ...w32(dirSize), ...w32(at), ...w16(0)]);
  const parts = [...body, ...dir, tail], out = new Uint8Array(parts.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function workbook(tables: Table[]): Uint8Array {
  const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main", R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const sheet = (t: Table) => H + `<worksheet xmlns="${NS}"><sheetData>` + [t.columns, ...t.rows].map((row, r) =>
    `<row r="${r + 1}">` + row.map((v, c) => `<c r="${colName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join("") + "</row>").join("") + "</sheetData></worksheet>";
  return storeZip([
    { name: "[Content_Types].xml", text: H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + tables.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + "</Types>" },
    { name: "_rels/.rels", text: H + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", text: H + `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets>` + tables.map((t, i) => `<sheet name="${xml(t.title.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + "</sheets></workbook>" },
    { name: "xl/_rels/workbook.xml.rels", text: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + tables.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") + "</Relationships>" },
    ...tables.map((t, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheet(t) })),
  ]);
}

const htmlTable = (t: Table) => t.rows.length
  ? `<table><thead><tr>${t.columns.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";

/** The one line saying what the short document leaves out. */
export function scopeLine(items: FrozenItem[]): string {
  const scope = items.filter(x => x.type === ITEM.scope);
  if (!scope.length) return "Scope: no business processes recorded.";
  const out = scope.filter(x => !x.snapshot.inScope).length;
  return `Scope: ${scope.length - out} of ${scope.length} business processes in scope.` + (out ? ` The ${out} out of scope are listed below.` : "") + " The Excel export lists all of them.";
}

/** One HTML document for Word and for printing to PDF: requirements first, scope last, no empty sections. */
export function signOffDocument(title: string, facts: [string, string][], items: FrozenItem[], approved: boolean): string {
  const [reqs, decisions, flows, scope] = signOffTables(items);
  const outOfScope: Table = { ...scope, rows: scope.rows.filter(r => r[3] === "No") };
  const sections = [reqs, decisions, flows].filter(t => t.rows.length).map(t => `<h2>${esc(t.title)} (${t.rows.length})</h2>${htmlTable(t)}`).join("");
  const banner = approved ? "" : `<p class="draft">DRAFT. Not approved yet: for review only.</p>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#0F172A}h1{font-size:18pt;color:#0F766E}h2{font-size:12pt;margin-top:16pt;border-bottom:2px solid #0D9488;padding-bottom:2pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #CBD5E1;padding:3px 6px;text-align:left;vertical-align:top}th{background:#F1F5F9}.draft{border:2px solid #B91C1C;color:#B91C1C;font-weight:bold;padding:6px 10px}</style></head><body>${banner}<h1>${esc(title)}</h1>${facts.map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}${sections}<h2>Scope</h2><p>${esc(scopeLine(items))}</p>${htmlTable(outOfScope)}</body></html>`;
}

export function saveFile(fileName: string, data: Uint8Array | string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type })); a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Opens the print dialog, where the user can save as PDF. False if the pop-up was blocked. */
export function printHtml(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html); w.document.close(); w.focus(); w.print();
  return true;
}
