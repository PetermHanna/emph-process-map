// Converts Microsoft's workshop templates (Word files) into map/schema/workshops.json, which the app bundles.
// The templates: github.com/microsoft/dynamics365patternspractices, folder "workshops" (aka.ms/businessprocessworkshops),
// one "<end-to-end> workshops.docx" per end-to-end process. That repository is licensed CC BY 4.0 (LICENSE) and
// CC BY-SA 4.0 (LICENSE-ASSETS); workshops.json is shared under CC BY-SA 4.0 with attribution (see README).
//
// Usage, from the repo root:  node map/schema/import-workshops.mjs <folder with the .docx files> [urls.txt]
//
// What is read per workshop (a Heading 1 title, or a Heading 2 under Acquire to dispose's "detailed design workshops"):
// the description (text before the first part), Assumptions, Objectives, Agenda, Stakeholders, Key questions (topic lines
// and their questions: a line without "?" followed by a question is a topic), and for a scenario board its areas
// ("80.10 Develop project strategy"), group headers (by the Word list levels) and cards, and the bands along the bottom of
// the board picture (text of the EMF picture). Every question keeps its source: file › workshop › topic.
// Kinds: scenario board / storyboard -> board, storyline design review -> storyline, deep-dive / detailed design -> deepdive.
import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------- the .docx (a zip) ----------
export function unzip(buf) {
  const b = Buffer.from(buf), out = new Map();
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  for (let k = 0; k < count && b.readUInt32LE(p) === 0x02014b50; k++) {
    const method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20), nlen = b.readUInt16LE(p + 28), xlen = b.readUInt16LE(p + 30), clen = b.readUInt16LE(p + 32), local = b.readUInt32LE(p + 42);
    const name = b.toString("utf8", p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const data = b.subarray(start, start + csize);
    if (name.endsWith("/")) continue;
    if (method === 0) out.set(name, data); else if (method === 8) out.set(name, inflateRawSync(data));
  }
  return out;
}

const unxml = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
/** The paragraphs of document.xml: heading level (0 = body), text, and the Word list level (-1 when not a list line). */
export function paragraphs(documentXml, stylesXml = "") {
  const names = {};
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>[\s\S]*?<w:name w:val="([^"]+)"/g)) names[m[1]] = m[2].toLowerCase();
  const out = [];
  for (const m of documentXml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const body = m[1];
    const sid = (/<w:pStyle w:val="([^"]+)"/.exec(body) || [])[1] || "";
    const style = names[sid] || sid.toLowerCase();
    const text = unxml(Array.from(body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g), x => x[1]).join("")).replace(/\s+/g, " ").trim();
    const level = Number((/^heading ?(\d)$/.exec(style) || [])[1]) || 0;
    const ilvl = /<w:numPr>/.test(body) ? Number((/<w:ilvl w:val="(\d)"/.exec(body) || [])[1] || 0) : -1;
    if (text) out.push({ level, text, ilvl });
  }
  return out;
}

/** board, storyline, deepdive, or "" when a title is not a workshop */
export function templateKind(title) {
  const t = title.toLowerCase();
  if (/scenario board|storyboard/.test(t)) return "board";
  if (/storyline design review/.test(t)) return "storyline";
  if (/deep-dive|deep dive|detailed design|design workshop|discovery workshop/.test(t)) return "deepdive";
  return "";
}
const PART = [
  [/^assumptions?\b/i, "assumption"], [/^objectives?\b/i, "objective"], [/agenda\b/i, "agenda"], [/^stakeholders?\b/i, "stakeholder"],
  [/^key questions?\b/i, "question"], [/^(scenario board|storyboard)$/i, "board"],
];
const partOf = t => (PART.find(([re]) => re.test(t.replace(/:\s*$/, ""))) || [])[1] || "";
const ROLE = /^(.{3,90}?)\s+[–-]\s+(responsible\b.*)$/i;
const GROUP = /^(scenarios|compliance|policies|metrics|reports|channels|kpis|migration ?& ?integration|integration ?& ?product fit|integrations?|[\w -]+ scenarios)$/i;
const ROMAN = /(?:^|(?<=[^\s(]))(?:xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\)\s*/g;

/** One run-together board line ("Scenariosi) A ii) B") as its group and cards; null when it is not one. */
export function splitRunTogether(line, anyHeader = false) {
  const m = /^([A-Z][A-Za-z &/,-]+?)((?:xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\)\s*.*)$/.exec(line);
  if (!m || (!anyHeader && !GROUP.test(m[1].trim()))) return null;
  return { group: m[1].trim(), cards: m[2].split(ROMAN).map(x => x.trim()).filter(Boolean) };
}

const AREA_LINE = /^(\d{2}\.\d{2})\s+(.+)$/;
/**
 * A scenario board section as Microsoft drew it: the areas in the guide's order (the guide's names), the cards under their
 * group headers, and the bands. With Word list levels a line with deeper lines under it is a group header, a line without
 * is a card, a line at the area's level that is no area is a band; without list levels the known header words decide.
 */
export function boardParts(lines) {
  const ls = lines.map(l => (typeof l === "string" ? { text: l, ilvl: -1 } : { text: l.text, ilvl: l.ilvl ?? -1 })).map(l => ({ ...l, text: l.text.trim() })).filter(l => l.text);
  const cards = [], areas = [], bands = [];
  let area = "", group = "", areaLvl = -1;
  for (let i = 0; i < ls.length; i++) {
    const { text: line, ilvl } = ls[i];
    const a = AREA_LINE.exec(line);
    if (a) { area = a[1]; group = ""; areaLvl = ilvl; if (!areas.some(x => x.code === area)) areas.push({ code: area, name: a[2].trim() }); continue; }
    if (!area) continue;
    const next = ls[i + 1];
    const listed = ilvl >= 0 && areaLvl >= 0;
    const hasKids = listed && !!next && next.ilvl > ilvl && !AREA_LINE.test(next.text);
    if (listed && ilvl <= areaLvl && !hasKids) { if (!bands.includes(line)) bands.push(line); continue; }
    const rt = splitRunTogether(line, listed && ilvl > areaLvl && !hasKids);
    if (rt) { rt.cards.forEach(text => cards.push({ area, group: rt.group, text })); group = rt.group; continue; }
    if (listed) {
      if (hasKids) { group = line.replace(/:\s*$/, ""); continue; }
      cards.push({ area, group: group || "Scenarios", text: line });
      continue;
    }
    if (GROUP.test(line)) { group = line; continue; }
    if (/:\s*$/.test(line) && line.length <= 60) { group = line.replace(/:\s*$/, ""); continue; }
    cards.push({ area, group: group || "Scenarios", text: line });
  }
  return { cards, areas, bands };
}

/** The text runs of an EMF picture (EMR_EXTTEXTOUTW records) with their position. */
export function pictureTexts(bytes) {
  const b = Buffer.from(bytes), out = [];
  if (b.length < 8 || b.readUInt32LE(0) !== 1) return out;
  for (let o = 0; o + 8 <= b.length;) {
    const type = b.readUInt32LE(o), size = b.readUInt32LE(o + 4);
    if (size < 8) break;
    if (type === 84 && o + 52 <= b.length) {
      const n = b.readUInt32LE(o + 44), off = b.readUInt32LE(o + 48);
      if (o + off + n * 2 <= b.length) out.push({ x: b.readInt32LE(o + 8), y: b.readInt32LE(o + 12), text: b.toString("utf16le", o + off, o + off + n * 2) });
    }
    o += size;
  }
  return out;
}
/** The bands of a board picture: labels along its bottom that stand alone (no list line within about 35 units). */
export function pictureBands(runs) {
  const rows = new Map();
  for (const r of runs) { const t = r.text.trim(); if (!t) continue; const row = rows.get(r.y) || []; row.push({ ...r, text: t }); rows.set(r.y, row); }
  const ys = Array.from(rows.keys()).sort((a, b) => a - b);
  const top = Math.min(...runs.filter(r => /^\d{2}\.\d{2}\b/.test(r.text.trim())).map(r => r.y));
  if (!isFinite(top)) return [];
  const out = [];
  for (let i = ys.length - 1; i >= 0; i--) {
    const y = ys[i], gapUp = i > 0 ? y - ys[i - 1] : Infinity, gapDown = i < ys.length - 1 ? ys[i + 1] - y : Infinity;
    if (y <= top || gapUp < 35 || gapDown < 35) break;
    const text = rows.get(y).sort((a, b) => a.x - b.x).map(r => r.text).join(" ");
    if (/:\s*$/.test(text)) break;
    out.unshift(text);
  }
  return out;
}

/** Key question lines as { group, text, question }; question false: a line to discuss that is not a question. */
export function keyQuestions(lines) {
  const out = [];
  let group = "General";
  lines.forEach((t, i) => {
    const q = /\?/.test(t), next = lines[i + 1];
    if (!q && t.length <= 120 && next && /\?/.test(next)) { group = t.replace(/:\s*$/, ""); return; }
    out.push({ group, text: t, question: q });
  });
  return out;
}

/** Roles listed in Assumptions under a line such as "The following stakeholders are recommended:" become stakeholders. */
export function guideRoles(items) {
  const assumptions = [], roles = [];
  let listing = false;
  for (const text of items.flatMap(x => x.split(/\s*•\s*/).map(t => t.trim()).filter(Boolean))) {
    const r = /^(.{3,90}?)\s+[–-]\s+(.+)$/.exec(text);
    if (listing && (r || (text.length <= 90 && !/[.:]\s*$/.test(text)))) { roles.push({ role: (r ? r[1] : text).trim(), why: r ? r[2].trim() : "" }); continue; }
    listing = /\b(stakeholders|roles|participants)\b/i.test(text) && /:\s*$/.test(text);
    assumptions.push(text);
  }
  return { assumptions, roles };
}
const completeAssumption = (text, roles) => (!/:\s*$/.test(text) || !/stakeholders|roles|recommended/i.test(text) || !roles.length ? text : text.replace(/:\s*$/, ": ") + roles.join("; ") + ".");
const norm = s => s.replace(/\s+/g, " ").trim();

/** The templates of one Word file. `e2e` is { code, name, areas: [{ code, name }] }. */
export function templatesOf(paras, file, e2e) {
  const tpls = [];
  let cur = null, part = "", buf = [], wsLevel = 1;
  const own = { board: 0, storyline: 0, deepdive: 0 };
  const flush = () => {
    if (!cur || !part) { buf = []; return; }
    const lines = buf.map(x => norm(x.text)).filter(Boolean);
    if (part === "description") cur.description = lines.join("\n");
    else if (part === "assumption") {
      const rest = [];
      for (const l of lines) { const r = ROLE.exec(l); if (r) cur.stakeholders.push({ role: r[1].trim(), why: r[2].trim() }); else if (!/recommended list of key stakeholders/i.test(l)) rest.push(l); }
      const split = guideRoles(rest);
      cur.stakeholders.push(...split.roles);
      cur.pending.push(...split.assumptions);
    } else if (part === "objective") cur.objectives.push(...lines);
    else if (part === "agenda") cur.agenda.push(...lines);
    else if (part === "stakeholder") for (const l of lines) { const r = ROLE.exec(l); cur.stakeholders.push(r ? { role: r[1].trim(), why: r[2].trim() } : { role: l.replace(/:\s*$/, ""), why: "" }); }
    else if (part === "question") cur.questions.push(...keyQuestions(lines));
    else if (part === "board") {
      const b = boardParts(buf.map(x => ({ text: norm(x.text), ilvl: x.ilvl ?? -1 })));
      cur.cards.push(...b.cards);
      b.areas.forEach(a => { if (!cur.areas.some(x => x.code === a.code)) cur.areas.push(a); });
      b.bands.forEach(x => { if (!cur.bands.includes(x)) cur.bands.push(x); });
    }
    buf = [];
  };
  const idOf = (title, kind) => {
    const m = /^(\d{2}(?:\.\d{2})(?:\.\d{3})?)\b/.exec(title);
    if (m) return m[1];
    own[kind]++;
    return e2e.code + "." + (kind === "board" ? "01" : kind === "storyline" ? "02" : "D" + String(own[kind]).padStart(2, "0"));
  };
  const unitOf = (id, title, kind) => {
    if (kind !== "deepdive") return e2e.code;
    const m = /^\d{2}\.(\d{2})/.exec(id);
    if (m && m[1] !== "01" && m[1] !== "02" && !/^\d{2}\.D/.test(id)) return id.slice(0, 5);
    const t = title.toLowerCase();
    const a = e2e.areas.find(x => t.includes(x.name.toLowerCase()));
    return a ? a.code : e2e.code;
  };
  for (const p of paras) {
    if (p.level) {
      const kind = p.level <= 2 && p.text.length <= 120 ? templateKind(p.text) : "";
      const pt = partOf(p.text);
      if (kind && !pt) {
        flush();
        if (p.level === 1 && /workshops$/i.test(p.text.trim())) { cur = null; part = ""; wsLevel = 2; continue; }
        const id = idOf(p.text, kind);
        cur = { id, kind, unit: unitOf(id, p.text, kind), title: norm(p.text), description: "", source: file + " › " + norm(p.text), pending: [], assumptions: [], objectives: [], agenda: [], stakeholders: [], questions: [], cards: [], areas: [], bands: [] };
        tpls.push(cur); part = "description"; wsLevel = p.level; continue;
      }
      if (!cur) continue;
      if (pt) { flush(); part = pt; continue; }
      if (p.level <= wsLevel) { flush(); cur = null; part = ""; continue; }
      if (part === "description" && p.text.length > 120) { buf.push(p); continue; }
      flush(); part = "";
      continue;
    }
    if (cur && part) buf.push(p);
  }
  flush();
  for (const t of tpls) { t.assumptions = t.pending.map(a => completeAssumption(a, t.stakeholders.map(s => s.role))); delete t.pending; }
  return tpls;
}

/** A template as the app reads it; each question with its source (file › workshop › topic). */
export function appTemplate(t, inCatalog) {
  const q = t.questions.map(x => ({ group: x.group, text: x.text, ...(x.question ? {} : { statement: true }), source: t.source + (x.group ? " › " + x.group : "") }));
  return {
    id: t.id, kind: t.kind, unit: t.unit, ...(inCatalog ? {} : { unitNotInCatalog: true }), title: t.title, description: t.description, source: t.source,
    assumptions: t.assumptions, objectives: t.objectives, agenda: t.agenda, stakeholders: t.stakeholders, questions: q,
    ...(t.kind === "board" ? { areas: t.areas, cards: t.cards, bands: t.bands } : {}),
  };
}

function main() {
  const [folder, urlsArg] = process.argv.slice(2);
  if (!folder) { console.log("usage: node map/schema/import-workshops.mjs <folder with the .docx files> [urls.txt]"); process.exit(2); }
  const catalog = JSON.parse(fs.readFileSync(path.join(here, "catalog.json"), "utf8"));
  const known = new Set(catalog.endToEnd.flatMap(e => [e.code, ...(e.areas || []).map(a => a.code)]));
  const templates = [];
  for (const file of fs.readdirSync(folder).filter(f => /\.docx$/i.test(f) && !f.startsWith("~$")).sort()) {
    const files = unzip(fs.readFileSync(path.join(folder, file)));
    const text = f => (files.get(f) ? files.get(f).toString("utf8") : "");
    const top = catalog.endToEnd.find(e => e.name.toLowerCase() === file.replace(/ workshops\.docx$/i, "").toLowerCase());
    if (!top) { console.log("no end-to-end process named like " + file + ": skipped"); continue; }
    const bands = Array.from(files.keys()).filter(k => /^word\/media\/.*\.emf$/i.test(k)).map(k => pictureTexts(files.get(k))).filter(r => r.some(x => /scenario board/i.test(x.text))).flatMap(pictureBands);
    const tp = templatesOf(paragraphs(text("word/document.xml"), text("word/styles.xml")), file, { code: top.code, name: top.name, areas: (top.areas || []).map(a => ({ code: a.code, name: a.name })) });
    for (const t of tp) {
      if (t.kind === "board") for (const x of bands) if (!t.bands.some(y => y.toLowerCase() === x.toLowerCase())) t.bands.push(x);
      templates.push(appTemplate(t, known.has(t.unit)));
    }
    const c = k => tp.filter(t => t.kind === k).length;
    console.log(file + ": " + tp.length + " templates (board " + c("board") + ", storyline " + c("storyline") + ", deep-dive " + c("deepdive") + "), "
      + tp.reduce((n, t) => n + t.questions.filter(q => q.question).length, 0) + " questions, " + tp.reduce((n, t) => n + t.cards.length, 0) + " board cards");
  }
  const dupes = templates.map(t => t.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupes.length) { console.log("duplicate template IDs: " + dupes.join(", ")); process.exit(1); }
  const urlsFile = urlsArg || path.join(folder, "urls.txt");
  const sources = fs.existsSync(urlsFile) ? fs.readFileSync(urlsFile, "utf8").split(/\r?\n/).map(s => s.trim()).filter(s => /\.docx$/i.test(s)) : [];
  const out = {
    source: { name: "Microsoft workshop templates (Business Process Catalog)", repository: "https://github.com/microsoft/dynamics365patternspractices/tree/main/workshops",
      licence: "CC BY 4.0 (LICENSE) and CC BY-SA 4.0 (LICENSE-ASSETS) of microsoft/dynamics365patternspractices; this converted file is shared under CC BY-SA 4.0",
      files: sources, importedOn: new Date().toISOString().slice(0, 10) },
    templates,
  };
  const target = path.join(here, "workshops.json");
  fs.writeFileSync(target, JSON.stringify(out).replace(/\},\{"id"/g, '},\n{"id"') + "\n");
  const questions = templates.reduce((n, t) => n + t.questions.filter(q => !q.statement).length, 0);
  console.log(templates.length + " templates, " + questions + " questions written to " + target);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
