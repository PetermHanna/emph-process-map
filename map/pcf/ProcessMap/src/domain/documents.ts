// Sign-off export in the browser with no extra library: an Excel workbook, a Word document and a print view for PDF.
import { ITEM, REQ_ORIGIN_LABEL, DELTA, LEVEL_LABEL, labelOf, moscowOf } from "./codes";
import { inScope, childrenOf, isOff, isActive, softwareOf, RAID_FIELDS } from "./rules";
import type { FrozenItem } from "./rules";
import type { Model, ProcessItem, Requirement, Raid } from "./types";

export interface Table { title: string; columns: string[]; rows: string[][] }

const DELTA_LABEL: Record<number, string> = { [DELTA.same]: "Unchanged", [DELTA.added]: "Added", [DELTA.changed]: "Changed", [DELTA.removed]: "Removed" };
const label = (m: Record<number, string>, v: unknown) => (v != null ? m[v as number] || "" : "");

/** A sign-off's contents as one table per kind of item. */
export function signOffTables(items: FrozenItem[]): Table[] {
  const of = (t: number) => items.filter(x => x.type === t);
  return [
    { title: "Requirements", columns: ["ID", "Description", "Raised by", "Origin", "Requirement type", "MoSCoW", "Priority", "Fit gap status", "Gap solution approach", "Estimated complexity", "Business approval state", "Owner", "Requirement mapping", "Approved by", "Approved on"],
      rows: of(ITEM.requirement).map(({ description, snapshot: x }) => [x.reqId || "", description, x.raisedBy || "", label(REQ_ORIGIN_LABEL, x.origin), labelOf("requirementType", x.type), moscowOf(x.priority), labelOf("priority", x.priority),
        labelOf("fitGapStatus", x.fitGap), labelOf("gapSolutionApproach", x.gapApproach), labelOf("estimatedComplexity", x.complexity), labelOf("businessApprovalState", x.approval), x.owner || "", x.mapping || "", x.approvedBy || "", x.approvedOn || ""]) },
    { title: "Configuration decisions", columns: ["Code", "Question", "Answer", "Process item"], rows: of(ITEM.decision).map(x => [x.name, x.description, x.snapshot.answer || "", x.snapshot.process || ""]) },
    { title: "Process flows", columns: ["Flow", "Activity", "Name", "Lane", "Change", "Rationale"],
      rows: of(ITEM.flow).flatMap(f => (f.snapshot.activities || []).map((a: any) => [f.name, a.code, a.name, a.lane || "", label(DELTA_LABEL, a.delta), a.rationale || ""])) },
    { title: "Scope", columns: ["Process sequence ID", "Process item", "Level", "Parent", "Scope", "In scope"], rows: of(ITEM.scope).map(x => [x.snapshot.code || "", x.name, String(x.snapshot.level ?? ""), x.snapshot.parent || "", labelOf("scope", x.snapshot.scope), x.snapshot.inScope ? "Yes" : "No"]) },
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
  if (!scope.length) return "Scope: no process items recorded.";
  const out = scope.filter(x => !x.snapshot.inScope).length;
  return `Scope: ${scope.length - out} of ${scope.length} process items in scope.` + (out ? ` The ${out} out of scope are listed below.` : "") + " The Excel export lists all of them.";
}

/** One HTML document for Word and for printing to PDF: requirements first, scope last, no empty sections. */
export function signOffDocument(title: string, facts: [string, string][], items: FrozenItem[], approved: boolean): string {
  const [reqs, decisions, flows, scope] = signOffTables(items);
  const outOfScope: Table = { ...scope, rows: scope.rows.filter(r => r[5] === "No") };
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

// ---------- Azure Boards import file (as Business Map's W1) ----------
// Microsoft's ADO template for Dynamics 365 projects: the catalog's work item types End to end, Process area, Process and
// Scenario, then Requirement and the RAID types, with the field names of Microsoft's catalog workbook (itself an Azure
// Boards export: "Process sequence ID MS BPC", "Scope MS BPC", ...). Azure Boards > Queries > Import work items reads a CSV:
// no ID for new items, a tree through the Title 1..n columns (a row is the child of the nearest row above it one Title
// column to the left), up to 1,000 rows per file. Fields the catalog workbook has no column for go into the HTML Description.
export const BOARDS_MAX_ROWS = 1000;
export const BOARDS_HEAD = ["ID", "Work Item Type", "Title 1", "Title 2", "Title 3", "Title 4", "Title 5", "Description", "Process sequence ID MS BPC", "Catalog status MS BPC", "Author MS BPC",
  "Process type MS BPC", "Products MS BPC", "Software solutions MS BPC", "Scope MS BPC", "Fit gap status MS BPC", "Gap solution approach MS BPC", "Scope approach MS BPC", "Baseline complexity MS BPC",
  "Business process owner MS BPC", "Workstream lead MS BPC", "Subject matter expert MS BPC", "Priority", "Tags"] as const;
type BoardsColumn = (typeof BOARDS_HEAD)[number];
/** Microsoft's work item type of a catalog level. */
export const LEVEL_TYPE: Record<number, string> = { 1: "End to end", 2: "Process area", 3: "Process", 4: "Scenario" };

const para = (label: string, v: string | null | undefined) => (v ? "<p><strong>" + esc(label) + ":</strong> " + esc(v).replace(/\r?\n/g, "<br>") + "</p>" : "");
const tagOf = (v: string) => v.replace(/;/g, ",").trim();
interface BoardsRow { depth: number; values: Partial<Record<BoardsColumn, string>> }

/**
 * The work items: every process item in scope (an item whose own scope is out or not applicable is listed with its scope,
 * without what lies below it), each followed by its active requirements and its RAID items; then the requirements and RAID
 * items on no exported item. Returns rows in BOARDS_HEAD order.
 */
export function boardsRows(m: Model): string[][] {
  const out: BoardsRow[] = [];
  const org = m.workspace.organisation;
  const tags = (...t: (string | false | null | undefined)[]) => ["EMPH", org, ...t].filter(Boolean).map(x => tagOf(x as string)).join("; ");
  const done = new Set<string>();
  const req = (r: Requirement, depth: number) => {
    done.add(r.id);
    out.push({ depth, values: { "Work Item Type": "Requirement", Description: [para("Requirement", r.description), para("Requirement type", labelOf("requirementType", r.type)), para("MoSCoW", moscowOf(r.priority)),
      para("Business approval state", labelOf("businessApprovalState", r.approval)), para("Estimated complexity", labelOf("estimatedComplexity", r.complexity)), para("Acceptance criteria", r.acceptanceCriteria),
      para("Requirement mapping", r.mapping), para("Owner", r.owner), para("Raised by", r.raisedBy), para("Source", r.sourceText ? "“" + r.sourceText + "”" + (r.sourceType ? " (" + r.sourceType + ")" : "") : "")].join(""),
      "Fit gap status MS BPC": labelOf("fitGapStatus", r.fitGap), "Gap solution approach MS BPC": labelOf("gapSolutionApproach", r.gapApproach), "Scope approach MS BPC": r.scopeApproach,
      "Author MS BPC": labelOf("author", r.author), Priority: labelOf("priority", r.priority), Title: (r.reqId ? r.reqId + " " : "") + r.name } as any });
  };
  const raid = (x: Raid, depth: number) => {
    done.add(x.id);
    const own = (RAID_FIELDS[x.type] || []).map(f => para(f.label, f.list ? labelOf(f.list, x[f.key] as number) : x[f.key] == null ? "" : String(x[f.key]))).join("");
    out.push({ depth, values: { "Work Item Type": labelOf("raidType", x.type), Priority: labelOf("priority", x.priority), Tags: tags(x.isQuestion && "Open question"),
      Description: [para("Description", x.description), para("Status", labelOf("raidStatus", x.status)), para("Owner", x.owner), para("Target date", x.targetDate), own, para("Heard", x.source)].join(""),
      Title: x.name } as any });
  };
  const item = (it: ProcessItem, depth: number) => {
    const on = inScope(m.items, it);
    out.push({ depth, values: { "Work Item Type": LEVEL_TYPE[it.level], Title: it.name, "Process sequence ID MS BPC": it.code, "Catalog status MS BPC": labelOf("catalogStatus", it.catalogStatus),
      "Author MS BPC": labelOf("author", it.author), "Process type MS BPC": labelOf("processType", it.processType), "Products MS BPC": softwareOf({ products: it.products }).join("; "),
      "Software solutions MS BPC": it.softwareSolution, "Scope MS BPC": labelOf("scope", it.scope), "Fit gap status MS BPC": it.level >= 3 ? labelOf("fitGapStatus", it.fitGap) : "",
      "Gap solution approach MS BPC": it.level >= 3 ? labelOf("gapSolutionApproach", it.gapApproach) : "", "Scope approach MS BPC": it.scopeApproach, "Baseline complexity MS BPC": labelOf("baselineComplexity", it.complexity),
      "Business process owner MS BPC": it.owner, "Workstream lead MS BPC": it.workstreamLead, "Subject matter expert MS BPC": it.sme, Priority: labelOf("priority", it.priority),
      Description: [esc(it.summary) ? "<p>" + esc(it.summary) + "</p>" : "", it.catalogName && it.catalogName !== it.name ? para("Microsoft name", it.catalogName) : "", para("Scope reason", it.scopeReason),
        para("Fit gap rationale", it.fitGapReason)].join(""), Tags: tags(it.isOwn && "Our own", LEVEL_LABEL[it.level]) } as any });
    if (!on) return;
    m.requirements.filter(r => r.itemId === it.id && isActive(r)).forEach(r => req(r, depth + 1));
    m.raids.filter(x => x.itemId === it.id).forEach(x => raid(x, depth + 1));
    childrenOf(m.items, it.id).sort((a, b) => a.rank - b.rank).filter(c => inScope(m.items, c) || (isOff(c.scope) && c.level > 1)).forEach(c => item(c, depth + 1));
  };
  m.items.filter(x => x.level === 1 && (inScope(m.items, x) || isOff(x.scope))).sort((a, b) => a.rank - b.rank).forEach(e => item(e, 0));
  m.requirements.filter(r => isActive(r) && !done.has(r.id)).forEach(r => req(r, 0));
  m.raids.filter(x => !done.has(x.id)).forEach(x => raid(x, 0));
  return out.map(r => BOARDS_HEAD.map(h => {
    if (h.startsWith("Title ")) return Number(h.slice(6)) === Math.min(r.depth, 4) + 1 ? String((r.values as any).Title || "").replace(/\s+/g, " ").trim().slice(0, 255) : "";
    if (h === "Tags") return r.values.Tags ?? tags();
    return String(r.values[h] ?? "");
  }));
}

/** A CSV cell: always quoted, quotes doubled. */
const cell = (v: string) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
/**
 * The import files: header plus at most `max` rows each, UTF-8 with a byte order mark, CRLF lines. A file starts at an
 * end-to-end process (Title 1) where it can, so each tree arrives whole; one bigger than a file is cut where it must be.
 */
export function boardsFiles(rows: string[][], max = BOARDS_MAX_ROWS): string[] {
  const t1 = BOARDS_HEAD.indexOf("Title 1");
  const groups: string[][][] = [];
  for (const r of rows) { if (r[t1] || !groups.length) groups.push([]); groups[groups.length - 1].push(r); }
  const files: string[][][] = [[]];
  for (const g of groups) {
    const cur = files[files.length - 1];
    if (cur.length && cur.length + g.length > max) files.push([]);
    for (const r of g) { if (files[files.length - 1].length >= max) files.push([]); files[files.length - 1].push(r); }
  }
  return files.map(part => "﻿" + [BOARDS_HEAD as readonly string[], ...part].map(r => r.map(cell).join(",")).join("\r\n") + "\r\n");
}
